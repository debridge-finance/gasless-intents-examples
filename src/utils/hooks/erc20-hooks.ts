import { ExtendedHook, GasCompensationInfo, PlaceHolder } from "@gasless-intents/types";
import { replaceAmountPlaceholder, replaceNamedPlaceholders } from "../hooks-common";
import { createApproveCall, createTransferCall } from "@utils/contract-calls";
import { toHexPrefixString } from "@utils/string";
import { DE_BRIDGE_CONTRACTS, PLACEHOLDER_TOKEN_AMOUNT } from "../constants";

export function getApproveHook(
  userAddress: string,
  tokenAddress: string,
  chainId: number,
  spenderAddress: string = DE_BRIDGE_CONTRACTS.EVM.AllowanceHolder,
  amount: string = PLACEHOLDER_TOKEN_AMOUNT,
  gasCompensationInfo?: GasCompensationInfo,
  gasLimit?: string,
): ExtendedHook {
  const approveCall = createApproveCall(toHexPrefixString(tokenAddress), toHexPrefixString(spenderAddress), BigInt(amount));

  approveCall.data = replaceAmountPlaceholder(approveCall.data);

  const placeholder: PlaceHolder = {
    nameVariable: "amount",
    tokenAddress: tokenAddress,
    address: userAddress,
  };

  const approveHook: ExtendedHook = {
    isAtomic: true,
    data: approveCall.data,
    to: approveCall.to,
    value: approveCall.value.toString(),
    chainId: chainId,
    from: userAddress,
    placeHolders: [placeholder],
    gasCompensationInfo: gasCompensationInfo,
    gasLimit: gasLimit,
  };

  return approveHook;
}

export function getTransferHook(
  userAddress: string,
  beneficiaryAddress: string,
  tokenAddress: string,
  chainId: number,
  additionalAmount: string = "0",
  gasCompensationInfo?: GasCompensationInfo,
  gasLimit?: string,
): ExtendedHook {
  // Encode ERC-20 transfer with sentinel, then replace with {amount}
  const placeholderName = "amount1";
  const call = createTransferCall(toHexPrefixString(beneficiaryAddress), BigInt(PLACEHOLDER_TOKEN_AMOUNT));
  call.data = replaceNamedPlaceholders(call.data, [placeholderName]);

  const hook: ExtendedHook = {
    isAtomic: true,
    data: call.data,
    to: tokenAddress,
    value: "0",
    chainId: chainId,
    from: userAddress,
    placeHolders: [
      {
        nameVariable: placeholderName,
        tokenAddress: tokenAddress,
        address: userAddress,
        additionalAmount: additionalAmount
      },
    ],
    gasCompensationInfo: gasCompensationInfo,
    gasLimit: gasLimit,
  };

  return hook;
}
