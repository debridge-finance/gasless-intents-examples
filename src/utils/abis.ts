import { parseAbi } from "viem";

/** ERC-20 */
export const Erc20Abi = {
  Balance: parseAbi(["function balanceOf(address account) view returns (uint256)"]),
  Approve: parseAbi(["function approve(address spender, uint256 amount)"]),
  Transfer: parseAbi(["function transfer(address to, uint256 amount)"]),
} as const;

/** ERC-4626 vaults */
export const Erc4626Abi = {
  Decimals: parseAbi(["function decimals() view returns (uint8)"]),
  ConvertToAssets: parseAbi(["function convertToAssets(uint256 shares) view returns (uint256)"]),
  Deposit: parseAbi(["function deposit(uint256 assets, address receiver)"]),
  Withdraw: parseAbi(["function withdraw(uint256 assets, address receiver, address owner)"]),
} as const;

/** Aave V3 */
export const AaveV3Abi = {
  Supply: parseAbi(["function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode)"]),
  Withdraw: parseAbi(["function withdraw(address asset, uint256 amount, address to)"]),
} as const;
