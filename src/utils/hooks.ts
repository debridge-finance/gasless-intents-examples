import { ExtendedHook, PlaceHolder } from "@gasless-intents/types";
import { EVM_NATIVE_TOKEN, PLACEHOLDER_TOKEN_AMOUNT } from "./constants";
import { createAaveSupplyCall } from "./contract-calls";
import { clipHexPrefix, toHexPrefixString } from ".";

export async function getAaveSupplyHook(
  aaveContractAddress: `0x${string}`,
  tokenAddress: `0x${string}`,
  chainId: number,
  senderAddress: `0x${string}`,
  beneficiaryAddress: `0x${string}`,
): Promise<ExtendedHook> {
  if (!aaveContractAddress || aaveContractAddress.length === 0 || aaveContractAddress === EVM_NATIVE_TOKEN) {
    throw new Error(`Invalid AAVE contract address - ${tokenAddress} on chain ${chainId}`);
  }

  const hookTransaction = createAaveSupplyCall(
    aaveContractAddress,
    tokenAddress,
    BigInt(PLACEHOLDER_TOKEN_AMOUNT),
    beneficiaryAddress,
  );

  const modifiedCalldata = hookTransaction.data.replace(clipHexPrefix(PLACEHOLDER_TOKEN_AMOUNT), "{amount}");

  hookTransaction.data = toHexPrefixString(modifiedCalldata);

  const placeholder: PlaceHolder = {
    nameVariable: "amount",
    tokenAddress: tokenAddress,
    address: senderAddress,
  };

  const result: ExtendedHook = {
    isAtomic: true,
    data: hookTransaction.data,
    to: hookTransaction.to,
    value: hookTransaction.value.toString(),
    chainId,
    from: senderAddress,
    placeHolders: [placeholder],
  };

  return result;
}

export async function getSendNativeAssetHook(
  chainId: number,
  senderAddress: `0x${string}`,
  beneficiaryAddress: `0x${string}`,
  amount?: string,
): Promise<ExtendedHook> {
  const placeholder: PlaceHolder = {
    nameVariable: "amount",
    tokenAddress: EVM_NATIVE_TOKEN,
    address: senderAddress,
  };

  const result: ExtendedHook = {
    isAtomic: true,
    data: "0x",
    to: beneficiaryAddress,
    value: amount || "{amount}",
    chainId,
    from: senderAddress,
    placeHolders: [placeholder],
  };

  return result;
}
