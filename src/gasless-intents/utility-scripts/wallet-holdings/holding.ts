import { ChainName } from "./tokens";

/** A single non-zero asset balance held by the wallet on one chain. */
export type Holding = {
  chainName: ChainName | "Solana";
  chainId: number;
  symbol: string; // for logging
  tokenAddress: string; // token address / SPL mint, or the native sentinel
  isNative: boolean;
  rawBalance: bigint;
  decimals: number;
};
