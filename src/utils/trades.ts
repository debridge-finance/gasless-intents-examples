import { CrossChainTrade, SameChainTrade } from "../gasless-intents/types";
import { EVM_NATIVE_TOKEN, USDC } from "./constants";

export function getCrossChainTrade(
  signer: string,
  params: Partial<
    Omit<CrossChainTrade,
      | "srcChainAuthorityAddress"
      | "dstChainAuthorityAddress"
      | "dstChainTokenOutRecipient"
    >
  > & {
    dstChainTokenOutRecipient?: string;
  } = {}
): CrossChainTrade {
  const {
    srcChainId = 137,
    srcChainTokenIn = USDC.Polygon,
    srcChainTokenInAmount = "4000000",
    srcChainTokenInMinAmount = "4000000",
    srcChainTokenInMaxAmount = "4000000",
    dstChainId = 56,
    dstChainTokenOut = USDC.BNB,
    dstChainTokenOutAmount = "auto",
    dstChainTokenOutRecipient,
    prependOperatingExpenses = true,
  } = params;

  return {
    srcChainId,
    srcChainTokenIn,
    srcChainTokenInAmount,
    srcChainTokenInMinAmount,
    srcChainTokenInMaxAmount,
    dstChainId,
    dstChainTokenOut,
    dstChainTokenOutAmount,
    dstChainTokenOutRecipient: dstChainTokenOutRecipient ?? signer,
    srcChainAuthorityAddress: signer,
    dstChainAuthorityAddress: signer,
    prependOperatingExpenses,
  };
}

export function getSameChainTrade(
signer: string, params: Partial<
  Omit<SameChainTrade, "authorityAddress" | "tokenOutRecipient">
> & {
  tokenOutRecipient?: string;
} = {}): SameChainTrade {
  const {
    chainId = 137,
    tokenIn = USDC.Polygon,
    tokenInAmount = "4000000",
    tokenInMinAmount = "4000000",
    tokenInMaxAmount = "4000000",
    tokenOut = EVM_NATIVE_TOKEN, // MATIC on Polygon
    tokenOutRecipient,
    prependOperatingExpenses = true,
  } = params;

  return {
    chainId,
    tokenIn,
    tokenInAmount,
    tokenInMinAmount,
    tokenInMaxAmount,
    tokenOut,
    tokenOutRecipient: tokenOutRecipient ?? signer,
    authorityAddress: signer,
    prependOperatingExpenses,
  };
}