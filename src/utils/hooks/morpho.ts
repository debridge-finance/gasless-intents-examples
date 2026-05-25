import { clipHexPrefix, toHexPrefixString } from "@utils/string";
import { ExtendedHook, GasCompensationInfo, PlaceHolder } from "@gasless-intents/types";
import { EVM_NATIVE_TOKEN, PLACEHOLDER_TOKEN_AMOUNT } from "@utils/constants";
import { createDepositCall } from "@utils/contract-calls";
import { getVaultAddressByToken } from "@utils/morpho/get-vault-address";

export async function getMorphoDepositHook(
  tokenAddress: `0x${string}`,
  chainId: number,
  senderAddress: `0x${string}`,
  beneficiaryAddress: `0x${string}`,
  additionalAmount: string = "0",
  gasCompensationInfo?: GasCompensationInfo,
  gasLimit?: string,
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

  const placeholderName = "morphoDepositAmount";
  hookTransaction.data = hookTransaction.data.replace(clipHexPrefix(PLACEHOLDER_TOKEN_AMOUNT), `{${placeholderName}}`);

  const placeholder: PlaceHolder = {
    nameVariable: placeholderName,
    tokenAddress,
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
    gasLimit,
  };

  return result;
}
