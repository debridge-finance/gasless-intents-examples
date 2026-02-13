import { toHexPrefixString } from ".";
import { ExtendedHook, GasCompensationInfo, Hook, PlaceHolder } from "../gasless-intents/types";
import { EVM_NATIVE_TOKEN, PLACEHOLDER_TOKEN_AMOUNT } from "./constants";
import { createDepositCall, createTransferCall } from "./contract-calls";
import { replaceAmountPlaceholder, replaceNamedPlaceholders } from "./hooks-common";
import { getVaultAddressByToken } from "./morpho/get-vault-address";

export async function getMorphoDepositPosthook(tokenAddress: `0x${string}`, chainId: number, beneficiaryAddress: `0x${string}`): Promise<Hook> {
  const vaultAddress = await getVaultAddressByToken(tokenAddress, chainId);

  if (!vaultAddress || vaultAddress.length === 0 || vaultAddress === EVM_NATIVE_TOKEN) {
    throw new Error(`No Morpho vault found for token ${tokenAddress} on chain ${chainId}`);
  }

  const postHookTransaction = createDepositCall(toHexPrefixString(vaultAddress), BigInt(PLACEHOLDER_TOKEN_AMOUNT), beneficiaryAddress);

  postHookTransaction.data = replaceAmountPlaceholder(postHookTransaction.data);

  const result: Hook = {
    isAtomic: true,
    data: postHookTransaction.data,
    to: postHookTransaction.to,
    value: postHookTransaction.value.toString(),
    chainId,
    tokenAddress,
    from: beneficiaryAddress,
    preparePreRequiredActions: true
  }

  return result;
}

export async function getSendNativeAssetPosthook(chainId: number, senderAddress: `0x${string}`, beneficiaryAddress: `0x${string}`): Promise<Hook> {
  const result: Hook = {
    isAtomic: true,
    data: "0x",
    to: beneficiaryAddress,
    value: "{amount}",
    chainId,
    tokenAddress: EVM_NATIVE_TOKEN,
    from: senderAddress,
    preparePreRequiredActions: true
  }

  return result;
}

export async function getSendErc20PostHook(tokenAddress: `0x${string}`, chainId: number, senderAddress: `0x${string}`, beneficiaryAddress: `0x${string}`): Promise<Hook> {

  const postHookTransaction = createTransferCall(beneficiaryAddress, BigInt(PLACEHOLDER_TOKEN_AMOUNT));

  postHookTransaction.data = replaceAmountPlaceholder(postHookTransaction.data);

  const posthook: Hook = {
    isAtomic: true,
    data: postHookTransaction.data,
    to: tokenAddress,
    value: "0",
    chainId,
    tokenAddress,
    from: senderAddress,
    preparePreRequiredActions: true
  }

  return posthook;
}

/**
 * Builds an ExtendedHook for use as a post-hook, from pre-encoded calldata
 * containing N PLACEHOLDER_TOKEN_AMOUNT sentinels.
 */
export function buildExtendedPostHook(params: {
  chainId: number;
  from: string;
  to: string;
  data: string;
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