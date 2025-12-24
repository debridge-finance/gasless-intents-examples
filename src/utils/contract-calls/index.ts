import { encodeFunctionData, parseAbi, CallParameters, Address } from "viem";

const ERC20_APPROVE_ABI = parseAbi([
  "function approve(address spender, uint256 amount) external returns (bool)"
]);

const ERC20_TRANSFER_ABI = parseAbi([
  "function transfer(address to, uint256 amount) external returns (bool)"
]);

const ERC4626_VAULT_DEPOSIT_ABI = parseAbi([
  "function deposit(uint256 assets, address receiver) external returns (uint256 shares)"
]);

const AAVE_SUPPLY_ABI = parseAbi([
  "function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode)"
]);

export function createApproveCall(
  tokenAddress: Address,
  spenderAddress: Address,
  amount: bigint
): CallParameters {
  const data = encodeFunctionData({
    abi: ERC20_APPROVE_ABI,
    functionName: "approve",
    args: [spenderAddress, amount],
  });

  return {
    to: tokenAddress,
    data,
    value: 0n,
  };
}

export function createTransferCall(to: Address, amount: bigint): CallParameters {
  const data = encodeFunctionData({
    abi: ERC20_TRANSFER_ABI,
    functionName: "transfer",
    args: [to, amount],
  });

  return {
    to,
    data,
    value: 0n,
  };
}

export function createDepositCall(
  vaultAddress: Address,
  amount: bigint,
  receiverAddress: Address
): CallParameters {
  const data = encodeFunctionData({
    abi: ERC4626_VAULT_DEPOSIT_ABI,
    functionName: "deposit",
    args: [amount, receiverAddress],
  });

  return {
    to: vaultAddress,
    data,
    value: 0n,
  };
}

export function createAaveSupplyCall(contractAddress: string, assetAddress: `0x${string}`, supplyAmount: bigint, onBehalfOf: `0x${string}`, aaveReferralCode: number = 0) {
  const data = encodeFunctionData({
    abi: AAVE_SUPPLY_ABI,
    functionName: "supply",
    args: [assetAddress,
      supplyAmount,
      onBehalfOf,
      aaveReferralCode],
  });

  return {
    to: contractAddress,
    data,
    value: 0n,
  };
}