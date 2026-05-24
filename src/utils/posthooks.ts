import { clipHexPrefix, toHexPrefixString } from ".";
import { ExtendedHook, PlaceHolder } from "../gasless-intents/types";
import { EVM_NATIVE_TOKEN, PLACEHOLDER_TOKEN_AMOUNT } from "./constants";
import { createAaveWithdrawCall, createDepositCall, createTransferCall } from "./contract-calls";
import { replaceNamedPlaceholders } from "./hooks-common";
import { getVaultAddressByToken } from "./morpho/get-vault-address";

export async function getMorphoDepositExtendedHook(
  tokenAddress: `0x${string}`,
  chainId: number,
  beneficiaryAddress: `0x${string}`,
  placeholderName: string,
): Promise<ExtendedHook> {
  const vaultAddress = await getVaultAddressByToken(tokenAddress, chainId);

  if (!vaultAddress || vaultAddress.length === 0 || vaultAddress === EVM_NATIVE_TOKEN) {
    throw new Error(`No Morpho vault found for token ${tokenAddress} on chain ${chainId}`);
  }

  const hookTransaction = createDepositCall(
    toHexPrefixString(vaultAddress),
    BigInt(PLACEHOLDER_TOKEN_AMOUNT),
    beneficiaryAddress,
  );

  hookTransaction.data = hookTransaction.data.replace(clipHexPrefix(PLACEHOLDER_TOKEN_AMOUNT), `{${placeholderName}}`);

  const placeholder: PlaceHolder = {
    nameVariable: placeholderName,
    tokenAddress,
    address: beneficiaryAddress,
  };

  const result: ExtendedHook = {
    isAtomic: true,
    data: hookTransaction.data,
    to: hookTransaction.to,
    value: hookTransaction.value.toString(),
    chainId,
    from: beneficiaryAddress,
    placeHolders: [placeholder],
  };

  return result;
}

export async function getSendNativeAssetPrehook(
  chainId: number,
  senderAddress: `0x${string}`,
  beneficiaryAddress: `0x${string}`,
  amount?: bigint,
): Promise<ExtendedHook> {
  if (amount !== undefined) {
    return {
      isAtomic: true,
      data: "0x",
      to: beneficiaryAddress,
      value: amount.toString(),
      chainId,
      from: senderAddress,
      placeHolders: [],
    };
  }

  const placeholder: PlaceHolder = {
    nameVariable: "amount1",
    tokenAddress: EVM_NATIVE_TOKEN,
    address: senderAddress,
  };

  return {
    isAtomic: true,
    data: "0x",
    to: beneficiaryAddress,
    value: "{amount1}",
    chainId,
    from: senderAddress,
    placeHolders: [placeholder],
  };
}

export async function getSendErc20Hook(
  tokenAddress: `0x${string}`,
  chainId: number,
  senderAddress: `0x${string}`,
  beneficiaryAddress: `0x${string}`,
  additionalAmount?: bigint,
): Promise<ExtendedHook> {
  const postHookTransaction = createTransferCall(beneficiaryAddress, BigInt(PLACEHOLDER_TOKEN_AMOUNT));

  
  const placeholder: PlaceHolder = {
    nameVariable: "amount1",
    tokenAddress,
    address: senderAddress,
    additionalAmount: additionalAmount ? additionalAmount.toString() : undefined,
  }
  postHookTransaction.data = replaceNamedPlaceholders(postHookTransaction.data, [placeholder.nameVariable]);

  const posthook: ExtendedHook = {
    isAtomic: true,
    data: postHookTransaction.data,
    to: tokenAddress,
    value: "0",
    chainId,
    placeHolders: [placeholder],
    from: senderAddress,
  };

  return posthook;
}

export async function getAaveWithdrawExtendedHook(
  aaveContractAddress: `0x${string}`,
  tokenAddress: `0x${string}`,
  chainId: number,
  beneficiaryAddress: `0x${string}`,
  placeholderName: string,
  amountToWithdraw?: bigint,
): Promise<ExtendedHook> {
  if (!aaveContractAddress || aaveContractAddress.length === 0 || aaveContractAddress === EVM_NATIVE_TOKEN) {
    throw new Error(`Invalid AAVE contract address ${aaveContractAddress} for token ${tokenAddress} on chain ${chainId}`);
  }

  const hookTransaction = createAaveWithdrawCall(
    aaveContractAddress,
    tokenAddress,
    amountToWithdraw ?? BigInt(PLACEHOLDER_TOKEN_AMOUNT),
    beneficiaryAddress,
  );

  const modifiedCalldata = hookTransaction.data.replace(clipHexPrefix(PLACEHOLDER_TOKEN_AMOUNT), `{${placeholderName}}`);

  hookTransaction.data = toHexPrefixString(modifiedCalldata);

  const placeholder: PlaceHolder = {
    nameVariable: placeholderName,
    tokenAddress,
    address: beneficiaryAddress,
  };

  const result: ExtendedHook = {
    isAtomic: true,
    data: hookTransaction.data,
    to: hookTransaction.to,
    value: hookTransaction.value.toString(),
    chainId,
    from: beneficiaryAddress,
    placeHolders: [placeholder],
  };

  return result;
}
