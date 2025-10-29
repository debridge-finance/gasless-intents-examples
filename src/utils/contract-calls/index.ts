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