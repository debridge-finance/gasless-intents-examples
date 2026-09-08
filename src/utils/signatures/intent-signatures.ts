import { serializeSignature, SerializeSignatureParameters, SignTypedDataReturnType, WalletClient } from "viem";
import {
  Action,
  ActionType,
  BundleProposeResponse,
  EIP712Data,
  ProvidePlaceholdersData,
  Sign7702AuthorizationData,
  Sign712MetaMaskWithPlaceholdersData,
  SignatureTypes,
  SolanaSign,
  Tx,
  WalletClientMap,
  ProvidedDataMap,
  SignedDataItem,
} from "@gasless-intents/types";
import { Connection, Keypair, VersionedTransaction } from "@solana/web3.js";
import { SOLANA_RPC_URL } from "../constants";
import { prepareSolanaTransaction, signHexMessageBySolanaKey } from "../solana";
import { clipHexPrefix, toHexPrefixString } from "@utils/string";
import { substitutePlaceholdersInMessage } from "./placeholder-substitution";

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
    case SignatureTypes.PreSignedMessage: {
      throw new Error(
        "PreSignedMessage is already signed by the API. Pass it through in the bundle and omit it from signedData.",
      );
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

/**
 * Handles the two solver-hook action types: ProvidePlaceholders and
 * Sign712MetaMaskWithPlaceholders. Throws for any other type — callers should
 * route non-solver-hook actions to `signAction`.
 */
export async function provideDeferredPlaceholderData(
  action: Action,
  walletClient: WalletClient,
  providedDataMap: ProvidedDataMap,
): Promise<SignedDataItem> {
  if (action.type === SignatureTypes.ProvidePlaceholders) {
    const data = action.data as ProvidePlaceholdersData;
    return {
      actionId: action.actionId,
      signedData: "0x", // No signature required; the submit endpoint accepts "0x" for ProvidePlaceholders.
      providedData: buildProvidedData(action.actionId, data.placeholders, providedDataMap),
    };
  }

  if (action.type === SignatureTypes.Sign712MetaMaskWithPlaceholders) {
    const data = action.data as Sign712MetaMaskWithPlaceholdersData;
    const valuesForAction = providedDataMap[action.actionId] ?? {};

    data.message = substitutePlaceholdersInMessage(data.message, valuesForAction);

    const { domain, types, primaryType, message } = data;
    // @ts-ignore - viem's signTypedData has a strict overload we don't match here; the backend-supplied domain/types are trusted.
    const signedData = await walletClient.signTypedData({ domain, types, primaryType, message });
    return {
      actionId: action.actionId,
      signedData,
      providedData: buildProvidedData(action.actionId, data.placeholders, providedDataMap),
    };
  }

  throw new Error(`provideDeferredPlaceholderData received unsupported action type: ${action.type}`);
}

export async function submitEvmTx(tx: Tx, walletClient: WalletClient): Promise<string> {
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
  } as any);

  return hash;
}

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
  if (!walletClient.chain) {
    throw new Error("Wallet client has no chain information");
  }

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
 * Collects signatures for all actions in an intent.
 * Returns array of SignedDataItem objects (with optional `providedData` for
 * solver-hook actions). Solver-hook action types (ProvidePlaceholders,
 * Sign712MetaMaskWithPlaceholders) are dispatched through provideDeferredPlaceholderData;
 * all other types route through signAction.
 */
export async function getRequiredActionSignatures(
  requiredActions: Array<Action>,
  walletClient: WalletClient | Keypair,
  providedDataMap: ProvidedDataMap = {},
  options: { skipBudgetApprovalTransactions?: boolean } = {},
): Promise<SignedDataItem[]> {
  const signatures: SignedDataItem[] = [];

  if (!requiredActions || requiredActions.length === 0) {
    console.log("No actions to sign in this intent");
    return signatures;
  }

  // Process each action in the intent
  for (const action of requiredActions) {
    try {
      if (isPreSignedMessageAction(action)) {
        // API-signed refill authorization is already part of the proposal payload.
        continue;
      }

      if (options.skipBudgetApprovalTransactions && isBudgetTransactionAction(action)) {
        // Refill flows submit first, then broadcast the approval after native gas arrives.
        continue;
      }

      // Hook-executed Transactions are run by the solver — the user wallet must not submit them.
      // Propose description for these is literally "Ready-to-execute transaction. No signature
      // or placeholder values required." (e.g. direct hook + eager placeholder.) Emit a no-op
      // signedData entry so the submit payload still covers every actionId.
      if (isSolverExecutedHookAction(action)) {
        console.log(
          `Skipping solver-executed action ${action.actionId} (type=${action.type}, actions=${action.actions.join(",")})`,
        );
        signatures.push({ actionId: action.actionId, signedData: "0x" });
        continue;
      }

      if (isDeferredPlaceholderAction(action.type)) {
        const result = await provideDeferredPlaceholderData(action, walletClient as WalletClient, providedDataMap);
        signatures.push(result);
        console.log(`Handled deferred placeholder action ${action.actionId} of type ${action.type}`);
      } else {
        const signedData = await signAction(action, walletClient);
        signatures.push({ actionId: action.actionId, signedData });
        console.log(`Successfully signed action ${action.actionId}`);
      }
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
  providedDataMap: ProvidedDataMap = {},
  options: { skipBudgetApprovalTransactions?: boolean } = {},
): Promise<SignedDataItem[]> {
  if (!items || !Array.isArray(items)) return [];

  const signatures: SignedDataItem[] = [];

  for (const item of items) {
    if (!Array.isArray(item.requiredActions)) continue;

    const chainId = getChainId(item);
    if (!chainId) {
      throw new Error(`chainId not specified for itemw`);
    }

    if (!walletClientMap[chainId]) {
      throw new Error(`No wallet client found for chainId: ${chainId}`);
    }

    const sigs = await getRequiredActionSignatures(
      item.requiredActions,
      walletClientMap[chainId],
      providedDataMap,
      options,
    );
    signatures.push(...sigs);
  }

  return signatures;
}

/**
 * Main function to process a bundle of intents and collect all signatures.
 * Returns SignedDataItem objects for intents, preHooks, and postHooks. Pass
 * `providedDataMap` to supply hex values for deferred placeholders surfaced
 * via ProvidePlaceholders or Sign712MetaMaskWithPlaceholders actions.
 */
export async function processIntentBundleActions(
  bundle: BundleProposeResponse,
  walletClientMap: WalletClientMap,
  providedDataMap: ProvidedDataMap = {},
  options: { skipBudgetApprovalTransactions?: boolean } = {},
): Promise<SignedDataItem[]> {
  // Collect signatures for all bundle intents and hooks.
  const a = await collectSignaturesFromItems(
    bundle.intents,
    (i) => i.intent.intentChainId,
    walletClientMap,
    providedDataMap,
    options,
  );
  const b = await collectSignaturesFromItems(
    bundle.preHooks,
    (h) => h.hook.chainId,
    walletClientMap,
    providedDataMap,
    options,
  );
  const c = await collectSignaturesFromItems(
    bundle.postHooks,
    (h) => h.hook.chainId,
    walletClientMap,
    providedDataMap,
    options,
  );
  return [...a, ...b, ...c];
}

export async function processIntentBundle(
  bundle: BundleProposeResponse,
  walletClientMap: WalletClientMap,
  providedDataMap: ProvidedDataMap = {},
): Promise<SignedDataItem[]> {
  return processIntentBundleActions(bundle, walletClientMap, providedDataMap);
}

export function buildHookProvidedDataMap(
  bundle: BundleProposeResponse,
  placeholderValues: Record<string, string | undefined>,
): ProvidedDataMap {
  const providedDataMap: ProvidedDataMap = {};
  const hooks = [...(bundle.preHooks ?? []), ...(bundle.postHooks ?? [])];

  for (const hook of hooks) {
    for (const action of hook.requiredActions ?? []) {
      const placeholders = (action.data as { placeholders?: Array<{ nameVariable: string }> }).placeholders;
      if (!Array.isArray(placeholders)) continue;

      for (const { nameVariable } of placeholders) {
        const value = placeholderValues[nameVariable];
        if (value === undefined) continue;

        providedDataMap[action.actionId] = providedDataMap[action.actionId] ?? {};
        providedDataMap[action.actionId][nameVariable] = value;
      }
    }
  }

  return providedDataMap;
}

async function sign7702Authorization(walletClient: WalletClient, data: Sign7702AuthorizationData): Promise<`0x${string}`> {
  if (!data.chainId) {
    throw new Error("chainId not specified");
  }

  if (!walletClient.account) {
    throw new Error("Wallet client has no default account set");
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

function isDeferredPlaceholderAction(type: SignatureTypes): boolean {
  return (
    type === SignatureTypes.ProvidePlaceholders ||
    type === SignatureTypes.Sign712MetaMaskWithPlaceholders
  );
}

function isSolverExecutedHookAction(action: Action): boolean {
  return action.type === SignatureTypes.Transaction && (action.actions?.includes(ActionType.Hook) ?? false);
}

function isPreSignedMessageAction(action: Action): boolean {
  return action.type === SignatureTypes.PreSignedMessage || (action.actions?.includes(ActionType.SignRefill) ?? false);
}

function isBudgetTransactionAction(action: Action): boolean {
  return action.type === SignatureTypes.Transaction && (action.actions?.includes(ActionType.Budget) ?? false);
}

function buildProvidedData(
  actionId: string,
  placeholders: Array<{ nameVariable: string }>,
  providedDataMap: ProvidedDataMap,
): Record<string, string> {
  const valuesForAction = providedDataMap[actionId] ?? {};
  const out: Record<string, string> = {};

  for (const { nameVariable } of placeholders) {
    const value = valuesForAction[nameVariable];

    if (value === undefined) {
      throw new Error(
        `Missing providedData for action ${actionId} placeholder ${nameVariable}. ` +
          `Supply it via providedDataMap[${actionId}][${nameVariable}].`,
      );
    }

    out[nameVariable] = value;
  }
  return out;
}
