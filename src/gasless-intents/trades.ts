// Token Addresses
export const NATIVE_TOKEN = "0x0000000000000000000000000000000000000000";

// Polygon
export const POLYGON_WETH = "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619";
export const POLYGON_USDC = "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359";
export const POLYGON_USDT = "0xc2132d05d31c914a87c6611c10748aeb04b58e8f";

// BSC
export const BSC_WBNB = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";
export const BSC_USDC = "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d";
export const BSC_USDT = "0x55d398326f99059ff775485246999027b3197955";

// Type definitions

export type CrossChainTrade = {
  srcChainId: number;
  srcChainTokenIn: string;
  srcChainTokenInAmount: string;      // human: 6/18 decimals as string
  srcChainTokenInMinAmount: string;
  srcChainTokenInMaxAmount: string;
  dstChainId: number;
  dstChainTokenOut: string;
  dstChainTokenOutAmount: "auto" | string;
  dstChainTokenOutRecipient: string;
  srcChainAuthorityAddress: string;
  dstChainAuthorityAddress: string;
  prependOperatingExpenses: boolean;
};

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
    srcChainTokenIn = POLYGON_USDC,
    srcChainTokenInAmount = "4000000",
    srcChainTokenInMinAmount = "4000000",
    srcChainTokenInMaxAmount = "4000000",
    dstChainId = 56,
    dstChainTokenOut = BSC_USDC,
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

export type SingleChainSwap = {
  chainId: number;
  tokenIn: string;
  tokenInAmount: string;              // human: 6/18 decimals as string
  tokenInMinAmount: string;
  tokenInMaxAmount: string;
  tokenOut: string;
  tokenOutRecipient: string;
  authorityAddress: string;
  prependOperatingExpenses: boolean;
};

export function getSingleChainSwap(
signer: string, params: Partial<
  Omit<SingleChainSwap, "authorityAddress" | "tokenOutRecipient">
> & {
  tokenOutRecipient?: string;
} = {}): SingleChainSwap {
  const {
    chainId = 137,
    tokenIn = POLYGON_USDC,
    tokenInAmount = "4000000",
    tokenInMinAmount = "4000000",
    tokenInMaxAmount = "4000000",
    tokenOut = NATIVE_TOKEN, // MATIC on Polygon
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


export function getPolyUsdcToBscUsdcTrade(signer: string) {
  return {
    srcChainId: 137,
    srcChainTokenIn: POLYGON_USDC, // USDC on Polygon (bridged), 6 decimals
    srcChainTokenInAmount: "4000000",      // 4$ USDC
    srcChainTokenInMinAmount: "2000000",   // 2$ USDC
    srcChainTokenInMaxAmount: "3000000",   // 3$ USDC

    // Destination (BSC)
    dstChainId: 56,
    dstChainTokenOut: BSC_USDC, // USDC on BSC, 6 decimals
    dstChainTokenOutAmount: "auto",
    dstChainTokenOutRecipient: signer,

    // Authorities 
    srcChainAuthorityAddress: signer,
    dstChainAuthorityAddress: signer,

    // Flags
    prependOperatingExpenses: false,
  }
}

export function getPolyUsdcToBscWbnbTrade(signer: string) {
  return {
    srcChainId: 137,
    srcChainTokenIn: POLYGON_USDC, // USDC on Polygon
    srcChainTokenInAmount: "4000000", // 4 USDC
    srcChainTokenInMinAmount: "2000000",
    srcChainTokenInMaxAmount: "3000000",
    dstChainId: 56,
    dstChainTokenOut: BSC_WBNB, // WBNB on BSC
    dstChainTokenOutAmount: "auto",
    dstChainTokenOutRecipient: signer,
    srcChainAuthorityAddress: signer,
    dstChainAuthorityAddress: signer,
    prependOperatingExpenses: false,
  }
}

export function getPolyMaticToWethTrade(signer: string) {
  return {
    // Same-chain swap
    chainId: 137,
    tokenIn: NATIVE_TOKEN,
    tokenInAmount: "1000000000000000000", // 1 MATIC
    tokenInMinAmount: "1000000000000000000",
    tokenInMaxAmount: "1000000000000000000",
    tokenOut: POLYGON_WETH,
    tokenOutRecipient: signer,
    authorityAddress: signer,
    prependOperatingExpenses: true,
  }
}

export function getPolyMaticToBscWbnb(signer: string) {
  return {
    srcChainId: 137,
    srcChainTokenIn: NATIVE_TOKEN,
    srcChainTokenInAmount: "1000000000000000000", // 1 MATIC
    srcChainTokenInMinAmount: "1000000000000000000",
    srcChainTokenInMaxAmount: "1000000000000000000",
    dstChainId: 56,
    dstChainTokenOut: BSC_WBNB,
    dstChainTokenOutAmount: "auto",
    srcChainAuthorityAddress: signer,
    dstChainTokenOutRecipient: signer,
    dstChainAuthorityAddress: signer
  }
}

export function getPolyUsdcToBscUsdt(signer: string) {
  return {
    // USDC (Polygon) -> USDT (BSC)
    srcChainId: 137,
    srcChainTokenIn: POLYGON_USDC, // USDC on Polygon
    srcChainTokenInAmount: "11000000", // 11 USDC
    srcChainTokenInMinAmount: "9000000",
    srcChainTokenInMaxAmount: "10000000",
    dstChainId: 56,
    dstChainTokenOut: BSC_USDT, // USDT on BSC
    dstChainTokenOutAmount: "auto",
    dstChainTokenOutRecipient: signer,
    srcChainAuthorityAddress: signer,
    dstChainAuthorityAddress: signer,
    prependOperatingExpenses: false
  }
}

export function getPolyMaticToBscUsdt(signer: string) {
  return {
    // MATIC (Polygon) -> USDT (BSC)
    srcChainId: 137,
    srcChainTokenIn: NATIVE_TOKEN, // native MATIC
    srcChainTokenInAmount: "11000000000000000000", // 11 MATIC
    srcChainTokenInMinAmount: "9000000000000000000",
    srcChainTokenInMaxAmount: "10000000000000000000",
    dstChainId: 56,
    dstChainTokenOut: BSC_USDT,
    dstChainTokenOutAmount: "auto",
    dstChainTokenOutRecipient: signer,
    srcChainAuthorityAddress: signer,
    dstChainAuthorityAddress: signer,
    prependOperatingExpenses: false
  }
}

export function getPolyUsdtToBscUsdt(signer: string) {
  return {
    // USDT (Polygon) -> USDT (BSC)
    srcChainId: 137,
    srcChainTokenIn: POLYGON_USDT, // USDT on Polygon
    srcChainTokenInAmount: "10000000", // 10 USDT
    srcChainTokenInMinAmount: "10000000",
    srcChainTokenInMaxAmount: "10000000",
    dstChainId: 56,
    dstChainTokenOut: BSC_USDT,
    dstChainTokenOutAmount: "auto",
    dstChainTokenOutRecipient: signer,
    srcChainAuthorityAddress: signer,
    dstChainAuthorityAddress: signer,
    prependOperatingExpenses: false
  }
}