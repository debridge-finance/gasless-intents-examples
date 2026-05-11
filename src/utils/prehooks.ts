import { ExtendedHook, GasCompensationInfo, PlaceHolder } from "../gasless-intents/types";
import { replaceNamedPlaceholders } from "./hooks-common";

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
