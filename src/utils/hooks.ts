import { clipHexPrefix, toHexPrefixString } from ".";
import { Hook } from "../gasless-intents/types";
import { EVM_NATIVE_TOKEN, PLACEHOLDER_TOKEN_AMOUNT } from "./constants";
import { createAaveSupplyCall, createDepositCall, createTransferCall } from "./contract-calls";
import { getVaultAddressByToken } from "./morpho/get-vault-address";

export async function getMorphoDepositPosthook(tokenAddress: `0x${string}`, chainId: number, beneficiaryAddress: `0x${string}`): Promise<Hook> {
  const vaultAddress = await getVaultAddressByToken(tokenAddress, chainId);

  if (!vaultAddress || vaultAddress.length === 0 || vaultAddress === EVM_NATIVE_TOKEN) {
    throw new Error(`No Morpho vault found for token ${tokenAddress} on chain ${chainId}`);
  }

  const postHookTransaction = createDepositCall(toHexPrefixString(vaultAddress), BigInt(PLACEHOLDER_TOKEN_AMOUNT), beneficiaryAddress);

  const modifiedCalldata = postHookTransaction.data.replace(clipHexPrefix(PLACEHOLDER_TOKEN_AMOUNT), "{amount}");

  postHookTransaction.data = modifiedCalldata;

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

export async function getAaveSupplyHook(
  aaveContractAddress: `0x${string}`, 
  tokenAddress: `0x${string}`, 
  chainId: number, 
  beneficiaryAddress: `0x${string}`
): Promise<Hook> {
  if (!aaveContractAddress || aaveContractAddress.length === 0 || aaveContractAddress === EVM_NATIVE_TOKEN) {
    throw new Error(`Invalid AAVE contract address - ${tokenAddress} on chain ${chainId}`);
  }

  const hookTransaction = createAaveSupplyCall(aaveContractAddress, tokenAddress, BigInt(PLACEHOLDER_TOKEN_AMOUNT), beneficiaryAddress);

  const modifiedCalldata = hookTransaction.data.replace(clipHexPrefix(PLACEHOLDER_TOKEN_AMOUNT), "{amount}");

  hookTransaction.data = toHexPrefixString(modifiedCalldata);

  const result: Hook = {
    isAtomic: true,
    data: hookTransaction.data,
    to: hookTransaction.to,
    value: hookTransaction.value.toString(),
    chainId,
    tokenAddress,
    from: beneficiaryAddress,
    preparePreRequiredActions: true
  }

  return result;
}

export async function getSendNativeAssetHook(chainId: number, senderAddress: `0x${string}`, beneficiaryAddress: `0x${string}`, amount?: string): Promise<Hook> {
  const result: Hook = {
    isAtomic: true,
    data: "0x",
    to: beneficiaryAddress,
    value: amount || "{amount}",
    chainId,
    tokenAddress: EVM_NATIVE_TOKEN,
    from: senderAddress,
    preparePreRequiredActions: true
  }

  return result;
}

export async function getSendErc20Hook(tokenAddress: `0x${string}`, chainId: number, senderAddress: `0x${string}`, beneficiaryAddress: `0x${string}`, amount?: string): Promise<Hook> {

  const postHookTransaction = createTransferCall(beneficiaryAddress, BigInt(amount || PLACEHOLDER_TOKEN_AMOUNT));

  if (!amount) {
    const modifiedCalldata = postHookTransaction.data.replace(clipHexPrefix(PLACEHOLDER_TOKEN_AMOUNT), "{amount}");
    postHookTransaction.data = modifiedCalldata;
  }


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