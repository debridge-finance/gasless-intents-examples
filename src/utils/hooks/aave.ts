import { clipHexPrefix, toHexPrefixString } from "@utils/string";
import { ExtendedHook, GasCompensationInfo, PlaceHolder } from "@gasless-intents/types";
import { EVM_NATIVE_TOKEN, PLACEHOLDER_TOKEN_AMOUNT } from "@utils/constants";
import { createAaveSupplyCall, createAaveWithdrawCall } from "@utils/contract-calls";
import { replaceNamedPlaceholders } from "@utils/hooks-common";

export async function getAaveWithdrawHook(
  aaveContractAddress: `0x${string}`,
  tokenAddress: `0x${string}`,
  chainId: number,
  beneficiaryAddress: `0x${string}`,
  amountToWithdraw?: bigint,
  additionalAmount: string = "0",
  gasCompensationInfo?: GasCompensationInfo,
  gasLimit?: string,
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

  const placeholderName = "aaveWithdrawAmount";

  const modifiedCalldata = hookTransaction.data.replace(clipHexPrefix(PLACEHOLDER_TOKEN_AMOUNT), `{${placeholderName}}`);

  hookTransaction.data = toHexPrefixString(modifiedCalldata);

  const placeholder: PlaceHolder = {
    nameVariable: placeholderName,
    tokenAddress,
    address: beneficiaryAddress,
    additionalAmount,
  };

  const result: ExtendedHook = {
    isAtomic: true,
    data: hookTransaction.data,
    to: hookTransaction.to,
    value: hookTransaction.value.toString(),
    chainId,
    from: beneficiaryAddress,
    placeHolders: [placeholder],
    gasCompensationInfo,
    gasLimit
  };

  return result;
}

export async function getAaveSupplyHook(
  aaveContractAddress: `0x${string}`,
  tokenAddress: `0x${string}`,
  chainId: number,
  senderAddress: `0x${string}`,
  beneficiaryAddress: `0x${string}`,
  additionalAmount: string = "0",
  gasCompensationInfo?: GasCompensationInfo,
  gasLimit?: string
): Promise<ExtendedHook> {
  if (!aaveContractAddress || aaveContractAddress.length === 0 || aaveContractAddress === EVM_NATIVE_TOKEN) {
    throw new Error(`Invalid AAVE contract address - ${aaveContractAddress} on chain ${chainId} for token ${tokenAddress}`);
  }

  const hookTransaction = createAaveSupplyCall(
    aaveContractAddress,
    tokenAddress,
    BigInt(PLACEHOLDER_TOKEN_AMOUNT),
    beneficiaryAddress,
  );

  const placeholderName = "amount";

  const modifiedCalldata = replaceNamedPlaceholders(hookTransaction.data, [placeholderName]);

  hookTransaction.data = toHexPrefixString(modifiedCalldata);

  const placeholder: PlaceHolder = {
    nameVariable: `${placeholderName}`,
    tokenAddress: tokenAddress,
    address: senderAddress,
    additionalAmount,
  };

  const result: ExtendedHook = {
    isAtomic: true,
    data: hookTransaction.data,
    to: hookTransaction.to,
    value: hookTransaction.value.toString(),
    chainId,
    from: senderAddress,
    placeHolders: [placeholder],
    gasCompensationInfo,
    gasLimit
  };

  return result;
}
