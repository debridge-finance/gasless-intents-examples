import { ExtendedHook, GasCompensationInfo, PlaceHolder } from "@gasless-intents/types";
import { EVM_NATIVE_TOKEN } from "@utils/constants";

export async function getSendNativeAssetHook(
  senderAddress: `0x${string}`,
  beneficiaryAddress: `0x${string}`,
  chainId: number,
  additionalAmount: string = "0",
  gasCompensationInfo?: GasCompensationInfo,
  gasLimit?: string,
): Promise<ExtendedHook> {
  const placeholderName = "amount1";

  const placeholder: PlaceHolder = {
    nameVariable: placeholderName,
    tokenAddress: EVM_NATIVE_TOKEN,
    address: senderAddress,
    additionalAmount: additionalAmount,
  };

  const result: ExtendedHook = {
    isAtomic: true,
    data: "0x",
    to: beneficiaryAddress,
    value: `{${placeholderName}}`,
    chainId,
    from: senderAddress,
    placeHolders: [placeholder],
    gasCompensationInfo,
    gasLimit,
  };

  return result;
}
