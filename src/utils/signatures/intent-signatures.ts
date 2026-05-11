import { serializeSignature, SerializeSignatureParameters, SignTypedDataReturnType, WalletClient } from "viem";
import {
  Action,
  Bundle,
  EIP712Data,
  Sign7702AuthorizationData,
  SignatureTypes,
  SolanaSign,
  Tx,
  WalletClientMap,
} from "@gasless-intents/types";
import { Connection, Keypair, VersionedTransaction } from "@solana/web3.js";
import { SOLANA_RPC_URL } from "../constants";
import { prepareSolanaTransaction, signHexMessageBySolanaKey } from "../solana";
import { clipHexPrefix, toHexPrefixString } from "..";

export async function signAction(action: Action, walletClient: WalletClient | Keypair): Promise<string> {
  console.log(`Signing action: ${action.actionId} of type ${action.type}`);

  switch (action.type) {
    case SignatureTypes.Sign7702Authorization:
    case SignatureTypes.Sign712:
    case SignatureTypes.Sign712MetaMask:
    case SignatureTypes.Permit:
    case SignatureTypes.Permit2: {
      return evmActionSign(action, walletClient as WalletClient);
    }
    case SignatureTypes.Sign: {
      return solanaAuthorizationSign(action, walletClient as Keypair);
    }
    case SignatureTypes.SignTransaction: {
      return solanaVersionedTransactionSign(action, walletClient as Keypair);
    }
    case SignatureTypes.Transaction: {
      // Check if the transaction is EVM or Solana
      const tx = action.data as Tx;
      if (tx.to || tx.value) {
        return submitEvmTx(tx, walletClient as WalletClient);
      } else {
        return submitSolanaTx(tx.data, walletClient as Keypair);
      }
    }
    default: {
      throw new Error(`Unknown signing method: ${action.type}`);
    }
  }
}

async function submitEvmTx(tx: Tx, walletClient: WalletClient): Promise<string> {
  if (!walletClient.account) {
    throw new Error("Wallet client has no default account set");
  }

  const to = tx.to as `0x${string}` | undefined;
  const data = tx.data as `0x${string}`;
  const value = tx.value !== undefined ? BigInt(tx.value) : undefined;

  const hash = await walletClient.sendTransaction({
    account: walletClient.account,
    chain: walletClient.chain,
    to,
    value,
    data,
  } as any); // Just to silence the errors - we're for sure not sending blobs in this transaction

  return hash;
}

// Bug report - why does this even work on the backend? Managed to successfully submit a hex-prefixed base-58 encoded string. Stupid as it sounds.
async function submitSolanaTx(data: string, keypair: Keypair): Promise<string> {
  const connection = new Connection(SOLANA_RPC_URL, { commitment: "confirmed" });

  const signedTx = await prepareSolanaTransaction(SOLANA_RPC_URL, data, keypair);
  const raw = signedTx.serialize();
  const sig = await connection.sendRawTransaction(raw, { skipPreflight: false });
  return sig;
}

async function solanaAuthorizationSign(action: Action, keypair: Keypair): Promise<SignTypedDataReturnType> {
  const signingData = (action.data as SolanaSign).data;
  const signatures = signHexMessageBySolanaKey(signingData, keypair);
  return toHexPrefixString(signatures.hex);
}

function solanaVersionedTransactionSign(action: Action, keypair: Keypair): string {
  const signingData = (action.data as SolanaSign).data;
  const versionedTransaction = VersionedTransaction.deserialize(Buffer.from(clipHexPrefix(signingData), "hex"));
  versionedTransaction.sign([keypair]);

  return toHexPrefixString(Buffer.from(versionedTransaction.serialize()).toString("hex"));
}

async function evmActionSign(action: Action, walletClient: WalletClient): Promise<string> {
  // EIP-7702 Authorization
  if (action.type === SignatureTypes.Sign7702Authorization) {
    // Cast to Sign7702AuthorizationData to access specific properties
    const data = action.data as Sign7702AuthorizationData;
    const { contractAddress, nonce } = data;

    // For Sign7702Authorization, we need to determine the chainId
    // If not present in data, we can get it from the wallet client
    const chainId = data.chainId || walletClient.chain.id;

    const authData = {
      chainId,
      contractAddress,
      nonce,
    };

    return await sign7702Authorization(walletClient, authData);
  }

  // EIP-712 Typed Data - Sign712
  else if (
    action.type === SignatureTypes.Sign712 ||
    action.type === SignatureTypes.Sign712MetaMask ||
    action.type === SignatureTypes.Permit ||
    action.type === SignatureTypes.Permit2
  ) {
    const data = action.data as EIP712Data;
    const { domain, types, message, primaryType } = data;

    return sign712(walletClient, { domain, types, primaryType, message });
  } else {
    throw new Error("Unknown signing method");
  }
}

/**
 * Collects signatures for all actions in an intent
 * Returns array of { actionId, signedData } objects
 */
export async function getRequiredActionSignatures(
  requiredActions: Array<Action>,
  walletClient: WalletClient | Keypair,
): Promise<Array<{ actionId: string; signedData: string }>> {
  const signatures: Array<{ actionId: string; signedData: string }> = [];

  if (!requiredActions || requiredActions.length === 0) {
    console.log("No actions to sign in this intent");
    return signatures;
  }

  // Process each action in the intent
  for (const action of requiredActions) {
    try {
      const signature = await signAction(action, walletClient);
      signatures.push({
        actionId: action.actionId,
        signedData: signature,
      });
      console.log(`Successfully signed action ${action.actionId}`);
    } catch (error) {
      console.error(`Error signing action ${action.actionId}:`, error);
      throw error; // Propagate error to caller
    }
  }

  return signatures;
}

async function collectSignaturesFromItems<T extends { requiredActions?: Action[] }>(
  items: T[] | undefined,
  getChainId: (item: T) => number | undefined,
  walletClientMap: WalletClientMap,
): Promise<Array<{ actionId: string; signedData: string }>> {
  if (!items || !Array.isArray(items)) return [];

  const signatures: Array<{ actionId: string; signedData: string }> = [];

  for (const item of items) {
    if (!Array.isArray(item.requiredActions)) continue;

    const chainId = getChainId(item);
    if (!chainId) {
      throw new Error(`chainId not specified for itemw`);
    }

    if (!walletClientMap[chainId]) {
      throw new Error(`No wallet client found for chainId: ${chainId}`);
    }

    const sigs = await getRequiredActionSignatures(item.requiredActions, walletClientMap[chainId]);
    signatures.push(...sigs);
  }

  return signatures;
}

/**
 * Main function to process a bundle of intents and collect all signatures
 * Returns all signatures for both intents and post-hooks
 */
export async function processIntentBundle(
  bundle: Bundle,
  walletClientMap: WalletClientMap,
): Promise<Array<{ actionId: string; signedData: string }>> {
  // tmp debugging, TODO: FIX
  const a = await collectSignaturesFromItems(bundle.intents, (i) => i.intent.intentChainId, walletClientMap);
  const b = await collectSignaturesFromItems(bundle.preHooks, (h) => h.hook.chainId, walletClientMap);
  const c = await collectSignaturesFromItems(bundle.postHooks, (h) => h.hook.chainId, walletClientMap);
  return [...a, ...b, ...c];
}

async function sign7702Authorization(walletClient: WalletClient, data: Sign7702AuthorizationData): Promise<`0x${string}`> {
  if (!data.chainId) {
    throw new Error("chainId not specified");
  }

  const authorization = await walletClient.signAuthorization({
    ...data,
    nonce: Number(data.nonce),
    account: walletClient.account,
  });

  const signature = serializeSignature({
    r: authorization.r,
    s: authorization.s,
    yParity: authorization.yParity,
    v: authorization.v,
  } as SerializeSignatureParameters<"hex">);

  return signature;
}

async function sign712(walletClient: WalletClient, data: unknown): Promise<SignTypedDataReturnType> {
  // @ts-ignore
  const signature = await walletClient.signTypedData(data);
  return signature;
}
