import { clipHexPrefix, toHexPrefixString } from ".";
import { PostHook } from "../gasless-intents/types";
import { EVM_NATIVE_TOKEN, PLACEHOLDER_TOKEN_AMOUNT } from "./constants";
import { createDepositCall, createTransferCall } from "./contract-calls";
import { getVaultAddressByToken } from "./morpho/get-vault-address";

export async function getMorphoDepositPosthook(tokenAddress: `0x${string}`, chainId: number, beneficiaryAddress: `0x${string}`): Promise<PostHook> {
  const vaultAddress = await getVaultAddressByToken(tokenAddress, chainId);

  if (!vaultAddress || vaultAddress.length === 0 || vaultAddress === EVM_NATIVE_TOKEN) {
    throw new Error(`No Morpho vault found for token ${tokenAddress} on chain ${chainId}`);
  }

  const postHookTransaction = createDepositCall(toHexPrefixString(vaultAddress), BigInt(PLACEHOLDER_TOKEN_AMOUNT), beneficiaryAddress);

  const modifiedCalldata = postHookTransaction.data.replace(clipHexPrefix(PLACEHOLDER_TOKEN_AMOUNT), "{amount}");

  postHookTransaction.data = modifiedCalldata;

  const result: PostHook = {
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

export async function getSendNativeAssetPosthook(chainId: number, senderAddress: `0x${string}`, beneficiaryAddress: `0x${string}`): Promise<PostHook> {
  const result: PostHook = {
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

export async function getSendErc20PostHook(tokenAddress: `0x${string}`, chainId: number, senderAddress: `0x${string}`, beneficiaryAddress: `0x${string}`): Promise<PostHook> {

  const postHookTransaction = createTransferCall(beneficiaryAddress, BigInt(PLACEHOLDER_TOKEN_AMOUNT));

  const modifiedCalldata = postHookTransaction.data.replace(clipHexPrefix(PLACEHOLDER_TOKEN_AMOUNT), "{amount}");

  postHookTransaction.data = modifiedCalldata;

  const posthook: PostHook = {
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