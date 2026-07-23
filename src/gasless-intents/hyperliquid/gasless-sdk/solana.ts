import { Wallet } from 'ethers';
import {
  Connection,
  Keypair,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import { getAssociatedTokenAddressSync, getMint, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import bs58 from 'bs58';
import nacl from 'tweetnacl';

import { AppConfig } from './config';
import {
  FALLBACK_SOLANA_DECIMALS,
  SOLANA_NATIVE_MINT,
  isCrossVmTrade,
  isSolanaChainId,
} from './chains';
import { GaslessApiClient, IntentResponse, SignedDataItem } from './api';

export class SolanaRpc {
  private readonly connection: Connection;

  constructor(rpcUrl: string) {
    this.connection = new Connection(rpcUrl, 'confirmed');
  }

  getConnection(): Connection {
    return this.connection;
  }

  async decimals(mint: string): Promise<number> {
    const known = FALLBACK_SOLANA_DECIMALS[mint];
    if (known !== undefined) {
      return known;
    }
    const mintInfo = await getMint(this.connection, new PublicKey(mint));
    return mintInfo.decimals;
  }

  async balanceOf(mint: string, owner: string): Promise<bigint> {
    const ownerKey = new PublicKey(owner);
    if (mint === SOLANA_NATIVE_MINT) {
      return BigInt(await this.connection.getBalance(ownerKey));
    }

    const mintKey = new PublicKey(mint);
    const ata = getAssociatedTokenAddressSync(mintKey, ownerKey, false, TOKEN_PROGRAM_ID);
    try {
      const balance = await this.connection.getTokenAccountBalance(ata);
      return BigInt(balance.value.amount);
    } catch {
      return 0n;
    }
  }
}

export function isValidSolanaAddress(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

export function normalizeSolanaAddress(address: string): string {
  const trimmed = address.trim();
  if (!isValidSolanaAddress(trimmed)) {
    throw new Error(`Invalid Solana address "${address}".`);
  }
  return trimmed;
}

export function tryLoadSolanaKeypairFromEnv(raw: string | undefined): Keypair | null {
  const value = raw?.trim();
  if (value === undefined || value.length === 0) {
    return null;
  }

  if (value.startsWith('[')) {
    const bytes = Uint8Array.from(JSON.parse(value) as number[]);
    if (bytes.length !== 64) {
      throw new Error('HL_SOLANA_PRIVATE_KEY JSON array must contain 64 bytes.');
    }
    return Keypair.fromSecretKey(bytes);
  }

  return Keypair.fromSecretKey(bs58.decode(value));
}

export function loadSolanaKeypairFromEnv(raw: string | undefined): Keypair {
  const keypair = tryLoadSolanaKeypairFromEnv(raw);
  if (keypair === null) {
    throw new Error(
      'HL_SOLANA_PRIVATE_KEY is missing. Required when swapping from Solana (source-side signing).',
    );
  }
  return keypair;
}

export interface QuoteAddresses {
  userId: string;
  srcChainAuthorityAddress: string;
  dstChainTokenOutRecipient: string;
  dstChainAuthorityAddress: string;
}

export function resolveQuoteAddresses(params: {
  fromChainId: number;
  toChainId: number;
  srcAccount: string;
  evmAddress?: string;
  solanaAddress?: string;
  recipientOverride?: string;
  dstAuthorityOverride?: string;
}): QuoteAddresses {
  const {
    fromChainId,
    toChainId,
    srcAccount,
    evmAddress,
    solanaAddress,
    recipientOverride,
    dstAuthorityOverride,
  } = params;

  let receiver: string;
  if (recipientOverride !== undefined) {
    receiver = recipientOverride;
  } else if (isCrossVmTrade(fromChainId, toChainId)) {
    if (isSolanaChainId(toChainId)) {
      if (solanaAddress === undefined) {
        throw new Error(
          'Solana destination address is required for EVM → Solana routes. ' +
            'Set HL_SOLANA_RECIPIENT, pass --recipient, or set HL_SOLANA_PRIVATE_KEY.',
        );
      }
      receiver = solanaAddress;
    } else {
      if (evmAddress === undefined) {
        throw new Error(
          'EVM destination address is required for Solana → EVM routes. Set HL_PRIVATE_KEY.',
        );
      }
      receiver = evmAddress;
    }
  } else {
    receiver = srcAccount;
  }

  const dstChainAuthorityAddress = dstAuthorityOverride ?? receiver;

  return {
    userId: srcAccount,
    srcChainAuthorityAddress: srcAccount,
    dstChainTokenOutRecipient: receiver,
    dstChainAuthorityAddress,
  };
}

export interface TradeRouteArgs {
  fromChainId: number;
  toChainId: number;
  dryRun: boolean;
  recipient?: string;
  dstAuthority?: string;
  account?: string;
}

export interface TradeWalletContext {
  quote: QuoteAddresses;
  evm?: {
    wallet?: Wallet;
    address: string;
  };
  solana?: {
    address: string;
    keypair?: Keypair;
  };
  solanaSource: boolean;
  evmSource: boolean;
}

function resolveSolanaDestinationAddress(args: TradeRouteArgs, cfg: AppConfig): string {
  if (args.recipient !== undefined) {
    return normalizeSolanaAddress(args.recipient);
  }
  if (cfg.solanaRecipient !== undefined) {
    return normalizeSolanaAddress(cfg.solanaRecipient);
  }
  const keypair = tryLoadSolanaKeypairFromEnv(cfg.solanaPrivateKey);
  if (keypair !== null) {
    return keypair.publicKey.toBase58();
  }
  throw new Error(
    [
      'Solana destination address is required for EVM → Solana routes.',
      'Set HL_SOLANA_RECIPIENT (public address), pass --recipient, or set HL_SOLANA_PRIVATE_KEY.',
      'HL_SOLANA_PRIVATE_KEY is not required to receive — only to sign when swapping from Solana.',
    ].join('\n'),
  );
}

function resolveSolanaSourceAddress(args: TradeRouteArgs, cfg: AppConfig): string {
  const keypair = tryLoadSolanaKeypairFromEnv(cfg.solanaPrivateKey);
  if (keypair !== null) {
    return keypair.publicKey.toBase58();
  }
  if (args.recipient !== undefined) {
    return normalizeSolanaAddress(args.recipient);
  }
  if (cfg.solanaRecipient !== undefined) {
    return normalizeSolanaAddress(cfg.solanaRecipient);
  }
  throw new Error(
    '--dry-run from Solana needs a source address: set HL_SOLANA_PRIVATE_KEY, HL_SOLANA_RECIPIENT, or --recipient.',
  );
}

export function resolveTradeWallets(cfg: AppConfig, args: TradeRouteArgs): TradeWalletContext {
  const solanaSource = isSolanaChainId(args.fromChainId);
  const evmSource = !solanaSource;
  const solanaOnRoute = isSolanaChainId(args.fromChainId) || isSolanaChainId(args.toChainId);
  const evmOnRoute = !isSolanaChainId(args.fromChainId) || !isSolanaChainId(args.toChainId);

  let evm: TradeWalletContext['evm'];
  if (evmOnRoute) {
    if (args.dryRun) {
      const address: string | undefined =
        args.account ??
        (cfg.privateKey !== undefined ? new Wallet(cfg.privateKey).address : undefined);
      if (address === undefined) {
        throw new Error(
          '--dry-run needs an EVM account address: pass --account <0xaddr> or set HL_PRIVATE_KEY.',
        );
      }
      const wallet: Wallet | undefined =
        cfg.privateKey !== undefined ? new Wallet(cfg.privateKey) : undefined;
      evm = { wallet, address };
    } else {
      if (cfg.privateKey === undefined) {
        throw new Error(
          'HL_PRIVATE_KEY is required for this route (EVM signing or EVM recipient).',
        );
      }
      const wallet = new Wallet(cfg.privateKey);
      if (
        args.account !== undefined &&
        args.account.toLowerCase() !== wallet.address.toLowerCase()
      ) {
        throw new Error(
          '--account only applies to --dry-run; a real run signs and authors as the HL_PRIVATE_KEY address.',
        );
      }
      evm = { wallet, address: wallet.address };
    }
  }

  let solana: TradeWalletContext['solana'];
  if (solanaOnRoute) {
    if (solanaSource) {
      if (args.dryRun) {
        const keypair = tryLoadSolanaKeypairFromEnv(cfg.solanaPrivateKey);
        if (keypair !== null) {
          solana = { address: keypair.publicKey.toBase58(), keypair };
        } else {
          solana = { address: resolveSolanaSourceAddress(args, cfg) };
        }
      } else {
        const keypair = loadSolanaKeypairFromEnv(cfg.solanaPrivateKey);
        solana = { address: keypair.publicKey.toBase58(), keypair };
      }
    } else {
      const address = resolveSolanaDestinationAddress(args, cfg);
      const keypair = tryLoadSolanaKeypairFromEnv(cfg.solanaPrivateKey);
      solana = keypair ? { address, keypair } : { address };
    }
  }

  const srcAccount = solanaSource ? solana!.address : evm!.address;
  const dstAuthorityOverride =
    args.dstAuthority !== undefined
      ? isSolanaChainId(args.toChainId)
        ? normalizeSolanaAddress(args.dstAuthority)
        : args.dstAuthority
      : undefined;
  const recipientOverride =
    args.recipient !== undefined
      ? isSolanaChainId(args.toChainId)
        ? normalizeSolanaAddress(args.recipient)
        : isSolanaChainId(args.fromChainId)
          ? normalizeSolanaAddress(args.recipient)
          : args.recipient
      : undefined;

  const quote = resolveQuoteAddresses({
    fromChainId: args.fromChainId,
    toChainId: args.toChainId,
    srcAccount,
    evmAddress: evm?.address,
    solanaAddress: solana?.address,
    recipientOverride,
    dstAuthorityOverride,
  });

  return { quote, evm, solana, solanaSource, evmSource };
}

export function formatWalletSummary(ctx: TradeWalletContext): string {
  const lines = ['Wallets:'];
  if (ctx.evm) {
    lines.push(`  EVM:    ${ctx.evm.address}`);
  }
  if (ctx.solana) {
    const signer = ctx.solana.keypair ? ' (signer)' : ' (recipient only)';
    lines.push(`  Solana: ${ctx.solana.address}${signer}`);
  }
  lines.push(`  Quote userId: ${ctx.quote.userId}`);
  lines.push(`  Recipient:    ${ctx.quote.dstChainTokenOutRecipient}`);
  return lines.join('\n');
}

function hexToBuffer(hex: string): Buffer {
  const normalized = hex.startsWith('0x') ? hex.slice(2) : hex;
  return Buffer.from(normalized, 'hex');
}

function bufferToHex(buffer: Uint8Array): string {
  return `0x${Buffer.from(buffer).toString('hex')}`;
}

function actionKey(action: { actions?: string[] }): string | null {
  if (!Array.isArray(action.actions)) {
    return null;
  }
  return action.actions.join('_').toLowerCase();
}

function extractPayloadHex(action: { data: unknown }): string {
  const dataField = action.data as { data?: string } | undefined;
  const payloadHex = dataField?.data;
  if (!payloadHex) {
    throw new Error('Required action is missing data.data.');
  }
  return payloadHex;
}

async function refreshBlockhash(
  connection: Connection,
  keypair: Keypair,
  serializedHex: string,
): Promise<VersionedTransaction> {
  const { blockhash } = await connection.getLatestBlockhash('confirmed');
  const tx = VersionedTransaction.deserialize(hexToBuffer(serializedHex));
  const message = TransactionMessage.decompile(tx.message);
  message.recentBlockhash = blockhash;
  const refreshed = new VersionedTransaction(message.compileToV0Message());
  refreshed.sign([keypair]);
  return refreshed;
}

async function broadcastTransactionAction(
  connection: Connection,
  keypair: Keypair,
  serializedHex: string,
): Promise<string> {
  const tx = await refreshBlockhash(connection, keypair, serializedHex);
  const signature = await connection.sendRawTransaction(tx.serialize(), {
    skipPreflight: true,
  });

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed');

  return signature;
}

async function signIntentTransactionAction(
  api: GaslessApiClient,
  keypair: Keypair,
  serializedHex: string,
): Promise<string> {
  const refreshedHex = await api.refreshSolanaTransaction(serializedHex);
  const tx = VersionedTransaction.deserialize(hexToBuffer(refreshedHex));
  tx.sign([keypair]);
  return bufferToHex(tx.serialize());
}

function signMessageAction(keypair: Keypair, messageData: string): string {
  const messageBytes = new TextEncoder().encode(messageData);
  const signature = nacl.sign.detached(messageBytes, keypair.secretKey);
  return bufferToHex(signature);
}

export async function signSolanaRequiredActions(params: {
  connection: Connection;
  keypair: Keypair;
  api: GaslessApiClient;
  intents: IntentResponse[];
}): Promise<SignedDataItem[]> {
  const { connection, keypair, api, intents } = params;
  if (intents.length !== 1) {
    throw new Error('Expected exactly one intent in gasless bundle.');
  }

  const requiredActions = intents[0].requiredActions ?? [];
  const signed: SignedDataItem[] = [];

  for (const action of requiredActions) {
    const actionId = action.actionId;
    if (!actionId) {
      throw new Error('Required action is missing actionId.');
    }

    const key = actionKey(action);
    const payloadHex = extractPayloadHex(action);

    if (action.type === 'Transaction') {
      const txSignature = await broadcastTransactionAction(connection, keypair, payloadHex);
      signed.push({ actionId, signedData: txSignature });
      continue;
    }

    if (action.type === 'SignTransaction') {
      const signedTxHex = await signIntentTransactionAction(api, keypair, payloadHex);
      signed.push({ actionId, signedData: signedTxHex });
      continue;
    }

    if (action.type === 'Sign') {
      const dataField = action.data as { data?: string };
      const messageData = dataField?.data;
      if (!messageData) {
        throw new Error('Sign action is missing data.data.');
      }
      const signatureHex = signMessageAction(keypair, messageData);
      signed.push({ actionId, signedData: signatureHex });
      continue;
    }

    throw new Error(
      `Unsupported Solana required action: ${action.type ?? 'unknown'} (${key ?? 'no ops'})`,
    );
  }

  return signed;
}
