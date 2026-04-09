import { ExtendedHook, PlaceHolder } from "@gasless-intents/trades";
import { EVM_NATIVE_TOKEN, PLACEHOLDER_TOKEN_AMOUNT } from "@utils/constants";
import { createAaveWithdrawCall } from "@utils/contract-calls";
import { clipHexPrefix, toHexPrefixString } from "..";

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

  const modifiedCalldata = hookTransaction.data.replace(clipHexPrefix(PLACEHOLDER_TOKEN_AMOUNT), placeholderName);

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
