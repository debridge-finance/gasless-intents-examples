import { encodeFunctionData, CallParameters, Address } from "viem";
import { Erc20Abi, Erc4626Abi, AaveV3Abi } from "@utils/abis";

export function createApproveCall(tokenAddress: Address, spenderAddress: Address, amount: bigint): CallParameters {
  const data = encodeFunctionData({
    abi: Erc20Abi.Approve,
    functionName: "approve",
    args: [spenderAddress, amount],
  });

  return {
    to: tokenAddress,
    data,
    value: 0n,
  };
}

export function createTransferCall(to: Address, amount: bigint): { to: Address; data: string; value: bigint } {
  const data = encodeFunctionData({
    abi: Erc20Abi.Transfer,
    functionName: "transfer",
    args: [to, amount],
  });

  return {
    to,
    data,
    value: 0n,
  };
}

export function createDepositCall(vaultAddress: Address, amount: bigint, receiverAddress: Address): CallParameters {
  const data = encodeFunctionData({
    abi: Erc4626Abi.Deposit,
    functionName: "deposit",
    args: [amount, receiverAddress],
  });

  return {
    to: vaultAddress,
    data,
    value: 0n,
  };
}

/** AAVE V3 */

export function createAaveSupplyCall(
  contractAddress: `0x${string}`,
  assetAddress: `0x${string}`,
  supplyAmount: bigint,
  onBehalfOf: `0x${string}`,
  aaveReferralCode: number = 0,
) {
  const data = encodeFunctionData({
    abi: AaveV3Abi.Supply,
    functionName: "supply",
    args: [assetAddress, supplyAmount, onBehalfOf, aaveReferralCode],
  });

  return {
    to: contractAddress,
    data,
    value: 0n,
  };
}

export function createAaveWithdrawCall(
  contractAddress: `0x${string}`,
  assetAddress: `0x${string}`,
  withdrawAmount: bigint,
  to: `0x${string}`,
) {
  const data = encodeFunctionData({
    abi: AaveV3Abi.Withdraw,
    functionName: "withdraw",
    args: [assetAddress, withdrawAmount, to],
  });

  return {
    to: contractAddress,
    data,
    value: 0n,
  };
}
