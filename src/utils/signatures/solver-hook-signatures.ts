import { Keypair } from "@solana/web3.js";
import { WalletClient } from "viem";

import {
  Action,
  Bundle,
  EIP712Data,
  ProvidePlaceholdersData,
  Sign712MetaMaskWithPlaceholdersData,
  SignatureTypes,
  WalletClientMap,
} from "@gasless-intents/types";

import { signAction } from "./intent-signatures";

// providedData map, keyed by actionId → (nameVariable → hex value).
// Keying by actionId avoids collisions when multiple hooks share a placeholder name.
export type ProvidedDataMap = Record<string, Record<string, string>>;

export type SignedDataItem = {
  actionId: string;
  signedData: string;
  providedData?: Record<string, string>;
};

/**
 * Handles the two solver-hook action types: ProvidePlaceholders and
 * Sign712MetaMaskWithPlaceholders. Throws for any other type — callers should
 * route non-solver-hook actions to `signAction`.
 */
export async function signSolverHookAction(
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
    const { domain, types, primaryType, message } = data;
    // The API validates the signature against the marker'd message at submit time
    // (substituting before signing was rejected with "Failed to recover valid address").
    // The on-chain substitution uses providedData supplied separately.
    // @ts-ignore - viem's signTypedData has a strict overload we don't match here; the backend-supplied domain/types are trusted.
    const signedData = await walletClient.signTypedData({ domain, types, primaryType, message });
    return {
      actionId: action.actionId,
      signedData,
      providedData: buildProvidedData(action.actionId, data.placeholders, providedDataMap),
    };
  }

  throw new Error(`signSolverHookAction received unsupported action type: ${action.type}`);
}

/**
 * Top-level bundle processor for bundles that may contain solver-hook actions.
 * Delegates to the existing `signAction` for all non-solver-hook types and to
 * `signSolverHookAction` for the two new types. Matches the walk order of
 * `processIntentBundle` (intents → preHooks → postHooks).
 */
export async function processIntentBundleWithSolverHooks(
  bundle: Bundle,
  walletClientMap: WalletClientMap,
  providedDataMap: ProvidedDataMap = {},
): Promise<SignedDataItem[]> {
  const out: SignedDataItem[] = [];

  const intentSigs = await collectFromItems(
    bundle.intents,
    (i) => i.intent.intentChainId,
    walletClientMap,
    providedDataMap,
  );
  out.push(...intentSigs);

  const preHookSigs = await collectFromItems(
    bundle.preHooks,
    (h) => h.hook.chainId,
    walletClientMap,
    providedDataMap,
  );
  out.push(...preHookSigs);

  const postHookSigs = await collectFromItems(
    bundle.postHooks,
    (h) => h.hook.chainId,
    walletClientMap,
    providedDataMap,
  );
  out.push(...postHookSigs);

  return out;
}

async function collectFromItems<T extends { requiredActions?: Action[] }>(
  items: T[] | undefined,
  getChainId: (item: T) => number | undefined,
  walletClientMap: WalletClientMap,
  providedDataMap: ProvidedDataMap,
): Promise<SignedDataItem[]> {
  if (!items || !Array.isArray(items)) return [];

  const signatures: SignedDataItem[] = [];
  for (const item of items) {
    if (!Array.isArray(item.requiredActions)) continue;

    const chainId = getChainId(item);
    if (!chainId) {
      throw new Error("chainId not specified for item");
    }
    const walletClient = walletClientMap[chainId];
    if (!walletClient) {
      throw new Error(`No wallet client found for chainId: ${chainId}`);
    }

    for (const action of item.requiredActions) {
      if (isSolverHookAction(action.type)) {
        const result = await signSolverHookAction(action, walletClient as WalletClient, providedDataMap);
        console.log(`Handled solver-hook action ${action.actionId} of type ${action.type}`);
        signatures.push(result);
      } else {
        const signedData = await signAction(action, walletClient as WalletClient | Keypair);
        signatures.push({ actionId: action.actionId, signedData });
      }
    }
  }
  return signatures;
}

function isSolverHookAction(type: SignatureTypes): boolean {
  return (
    type === SignatureTypes.ProvidePlaceholders ||
    type === SignatureTypes.Sign712MetaMaskWithPlaceholders
  );
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

// Re-export for convenience so callers of this file don't also need to import from intent-signatures.
export type { EIP712Data };
