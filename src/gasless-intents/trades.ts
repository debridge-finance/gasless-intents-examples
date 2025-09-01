export function getPolyUsdcToBscUsdcTrade(signer: string) {
  return {
    srcChainId: 137,
    srcChainTokenIn: "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359", // USDC on Polygon (bridged), 6 decimals
    srcChainTokenInAmount: "4000000",      // 4$ USDC
    srcChainTokenInMinAmount: "2000000",   // 2$ USDC
    srcChainTokenInMaxAmount: "3000000",   // 3$ USDC

    // Destination (BSC)
    dstChainId: 56,
    dstChainTokenOut: "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d", // USDC on BSC, 6 decimals
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
    srcChainTokenIn: "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359", // USDC on Polygon
    srcChainTokenInAmount: "4000000", // 4 USDC
    srcChainTokenInMinAmount: "2000000",
    srcChainTokenInMaxAmount: "3000000",
    dstChainId: 56,
    dstChainTokenOut: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c", // WBNB on BSC
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
    tokenIn: "0x0000000000000000000000000000000000000000",
    tokenInAmount: "1000000000000000000", // 1 MATIC
    tokenInMinAmount: "1000000000000000000",
    tokenInMaxAmount: "1000000000000000000",
    tokenOut: "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619",
    tokenOutRecipient: signer,
    authorityAddress: signer,
    prependOperatingExpenses: true,
  }
}

export function getPolyMaticToBscWbnb(signer: string) {
  return {
    srcChainId: 137,
    srcChainTokenIn: "0x0000000000000000000000000000000000000000",
    srcChainTokenInAmount: "1000000000000000000", // 1 MATIC
    srcChainTokenInMinAmount: "1000000000000000000",
    srcChainTokenInMaxAmount: "1000000000000000000",
    dstChainId: 56,
    dstChainTokenOut: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
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
    srcChainTokenIn: "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359", // USDC on Polygon
    srcChainTokenInAmount: "11000000", // 11 USDC
    srcChainTokenInMinAmount: "9000000",
    srcChainTokenInMaxAmount: "10000000",
    dstChainId: 56,
    dstChainTokenOut: "0x55d398326f99059ff775485246999027b3197955", // USDT on BSC
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
    srcChainTokenIn: "0x0000000000000000000000000000000000000000", // native MATIC
    srcChainTokenInAmount: "11000000000000000000", // 11 MATIC
    srcChainTokenInMinAmount: "9000000000000000000",
    srcChainTokenInMaxAmount: "10000000000000000000",
    dstChainId: 56,
    dstChainTokenOut: "0x55d398326f99059ff775485246999027b3197955",
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
    srcChainTokenIn: "0xc2132d05d31c914a87c6611c10748aeb04b58e8f", // USDT on Polygon
    srcChainTokenInAmount: "10000000", // 10 USDT
    srcChainTokenInMinAmount: "10000000",
    srcChainTokenInMaxAmount: "10000000",
    dstChainId: 56,
    dstChainTokenOut: "0x55d398326f99059ff775485246999027b3197955",
    dstChainTokenOutAmount: "auto",
    dstChainTokenOutRecipient: "0x2d5696F81f467460A247d72950527Da0737A49C2",
    srcChainAuthorityAddress: "0x2d5696F81f467460A247d72950527Da0737A49C2",
    dstChainAuthorityAddress: "0x2d5696F81f467460A247d72950527Da0737A49C2",
    prependOperatingExpenses: false
  }
}