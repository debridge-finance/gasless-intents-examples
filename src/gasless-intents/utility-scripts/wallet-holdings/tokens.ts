import { type Chain } from "viem";
import { polygon, bsc, base, arbitrum, optimism, mainnet } from "viem/chains";
import { CHAIN_IDS } from "@utils/chains";
import {
  USDC, USDT, LINK, WBNB, WETH, WBTC, DAI, LINGO, SOL_JUP, DBR_SOL,
} from "@utils/constants";

export type ChainName = "Ethereum" | "Polygon" | "BNB" | "Base" | "Arbitrum" | "Optimism";

export const evmChainConfig: Record<ChainName, { envKey: string; chain: Chain; chainId: number; nativeSymbol: string }> = {
  Ethereum: { envKey: "MAINNET_RPC_URL", chain: mainnet, chainId: CHAIN_IDS.Ethereum, nativeSymbol: "ETH" },
  Polygon:  { envKey: "POLYGON_RPC_URL", chain: polygon, chainId: CHAIN_IDS.Polygon, nativeSymbol: "MATIC" },
  BNB:      { envKey: "BNB_RPC_URL", chain: bsc, chainId: CHAIN_IDS.BNB, nativeSymbol: "BNB" },
  Base:     { envKey: "BASE_RPC_URL", chain: base, chainId: CHAIN_IDS.Base, nativeSymbol: "ETH" },
  Arbitrum: { envKey: "ARB_RPC_URL", chain: arbitrum, chainId: CHAIN_IDS.Arbitrum, nativeSymbol: "ETH" },
  Optimism: { envKey: "OPTIMISM_RPC_URL", chain: optimism, chainId: CHAIN_IDS.Optimism, nativeSymbol: "ETH" },
};

// Token definitions: symbol -> { chainName -> { address, decimals } }
export const tokenRegistry: Record<string, Partial<Record<ChainName | "Solana", { address: string; decimals: number }>>> = {
  USDC: {
    Ethereum: { address: USDC.Ethereum, decimals: 6 },
    Polygon:  { address: USDC.Polygon, decimals: 6 },
    BNB:      { address: USDC.BNB, decimals: 18 },
    Base:     { address: USDC.Base, decimals: 6 },
    Arbitrum: { address: USDC.Arbitrum, decimals: 6 },
    Optimism: { address: USDC.Optimism, decimals: 6 },
    Solana:   { address: USDC.Solana, decimals: 6 },
  },
  USDT: {
    Ethereum: { address: USDT.Ethereum, decimals: 6 },
    Polygon:  { address: USDT.Polygon, decimals: 6 },
    BNB:      { address: USDT.BNB, decimals: 18 },
    Arbitrum: { address: USDT.Arbitrum, decimals: 6 },
    Base:     { address: USDT.Base, decimals: 6 },
    Solana:   { address: USDT.Solana, decimals: 6 },
  },
  DAI: {
    Polygon:  { address: DAI.Polygon, decimals: 18 },
    Arbitrum: { address: DAI.Arbitrum, decimals: 18 },
    Ethereum: { address: DAI.Ethereum, decimals: 18 },
  },
  WETH: {
    Ethereum: { address: WETH.Ethereum, decimals: 18 },
    Polygon:  { address: WETH.Polygon, decimals: 18 },
    Arbitrum: { address: WETH.Arbitrum, decimals: 18 },
  },
  LINK: {
    Polygon: { address: LINK.Polygon, decimals: 18 },
  },
  WBNB: {
    BNB: { address: WBNB.BNB, decimals: 18 },
  },
  WBTC: {
    Ethereum: { address: WBTC.Ethereum, decimals: 8 },
  },
  LINGO: {
    Base: { address: LINGO.Base, decimals: 18 },
  },
  WSOL: {
    Solana: { address: "So11111111111111111111111111111111111111112", decimals: 9 },
  },
  JUP: {
    Solana: { address: SOL_JUP, decimals: 6 },
  },
  DBR: {
    Solana: { address: DBR_SOL, decimals: 6 },
  },
};
