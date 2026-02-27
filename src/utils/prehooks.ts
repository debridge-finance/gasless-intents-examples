import { ExtendedHook, GasCompensationInfo, Hook, PlaceHolder } from "../gasless-intents/types";
import { replaceAmountPlaceholder, replaceNamedPlaceholders } from "./hooks-common";

/**
 * Builds a SimpleHook (simple format) from pre-encoded calldata containing
 * one PLACEHOLDER_TOKEN_AMOUNT sentinel. Replaces it with {amount}.
 */
export function buildSimplePreHook(params: {
  chainId: number;
  from: string;
  to: string;
  data: string;          // calldata with one PLACEHOLDER_TOKEN_AMOUNT
  value?: string;
  tokenAddress: string;
  isAtomic?: boolean;
}): Hook {
  return {
    isAtomic: params.isAtomic ?? true,
    data: replaceAmountPlaceholder(params.data),
    to: params.to,
    value: params.value ?? "0",
    chainId: params.chainId,
    tokenAddress: params.tokenAddress,
    from: params.from,
    preparePreRequiredActions: true,
  };
}

/**
 * Builds an ExtendedHook for use as a pre-hook, from pre-encoded calldata
 * containing N PLACEHOLDER_TOKEN_AMOUNT sentinels.
 */
export function buildExtendedPreHook(params: {
  chainId: number;
  from: string;
  to: string;
  data: string;          // calldata with N PLACEHOLDER_TOKEN_AMOUNT sentinels
  value?: string;
  placeHolders: PlaceHolder[];
  gasCompensationInfo?: GasCompensationInfo;
  isAtomic?: boolean;
}): ExtendedHook {
  const names = params.placeHolders.map(p => p.nameVariable);
  return {
    isAtomic: params.isAtomic ?? true,
    data: replaceNamedPlaceholders(params.data, names),
    to: params.to,
    value: params.value ?? "0",
    chainId: params.chainId,
    from: params.from,
    placeHolders: params.placeHolders,
    gasCompensationInfo: params.gasCompensationInfo,
  };
}
