import { ExtendedHook, GasCompensationInfo, PlaceHolder } from "@gasless-intents/types";
import { EVM_NATIVE_TOKEN, PLACEHOLDER_TOKEN_AMOUNT } from "./constants";
import { createAaveSupplyCall } from "./contract-calls";
import { toHexPrefixString } from ".";
import { replaceNamedPlaceholders } from "./hooks-common";

export async function getAaveSupplyHook(
  aaveContractAddress: `0x${string}`,
  tokenAddress: `0x${string}`,
  chainId: number,
  senderAddress: `0x${string}`,
  beneficiaryAddress: `0x${string}`,
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
