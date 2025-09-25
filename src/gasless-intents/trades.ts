import {arbitrum} from "viem/chains";

export function getPolyUsdcToBscUsdcTrade(signer: string) {
  return {
    srcChainId: 137,
    srcChainTokenIn: "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359", // USDC on Polygon (bridged), 6 decimals
    srcChainTokenInAmount: (10**5).toString(),      // 4$ USDC
    srcChainTokenInMinAmount: (10**5).toString(),   // 2$ USDC
    srcChainTokenInMaxAmount: (10**5).toString(),   // 3$ USDC

    // Destination (BSC)
    dstChainId: 56,
    dstChainTokenOut: "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d", // USDC on BSC, 6 decimals
    dstChainTokenOutAmount: "auto",
    dstChainTokenOutRecipient: signer,

    // Authorities 
    srcChainAuthorityAddress: signer,
    dstChainAuthorityAddress: signer,

    // Flags
    prependOperatingExpenses: true,
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
    tokenInAmount: "100000000000000000", // 1 MATIC
    tokenInMinAmount: "100000000000000000",
    tokenInMaxAmount: "100000000000000000",
    tokenOut: "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619",
    tokenOutRecipient: signer,
    authorityAddress: signer,
    prependOperatingExpenses: true,
  }
}

export function getBscNativeToUsdc(signer: string) {
  return {
    // Same-chain swap
    chainId: 56,
    tokenIn: "0x0000000000000000000000000000000000000000",
    tokenInAmount: "100000000000000", // 1 MATIC
    tokenInMinAmount: "100000000000000",
    tokenInMaxAmount: "100000000000000",
    tokenOut: "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d",
    tokenOutRecipient: signer,
    authorityAddress: signer,
    prependOperatingExpenses: true,
  }
}

export function getBscNativeToPolNativeTrade(signer: string) {
  return {
    srcChainId: 56,
    srcChainTokenIn: "0x0000000000000000000000000000000000000000", // USDC on Polygon (bridged), 6 decimals
    srcChainTokenInAmount: "1000000000000000",      // 4$ USDC
    srcChainTokenInMinAmount: "1000000000000000",   // 2$ USDC
    srcChainTokenInMaxAmount: "1000000000000000",   // 3$ USDC

    // Destination (BSC)
    dstChainId: 10,
    dstChainTokenOut: "0x0000000000000000000000000000000000000000", // "0x0000000000000000000000000000000000000000", // USDC on BSC, 6 decimals
    dstChainTokenOutAmount: "auto",
    dstChainTokenOutRecipient: signer,

    // Authorities
    srcChainAuthorityAddress: signer,
    dstChainAuthorityAddress: signer,

    // Flags
    prependOperatingExpenses: true,
  }
}


export function getPolyMaticToBscWbnb(signer: string) {
  return {
    srcChainId: 137,
    srcChainTokenIn: "0x0000000000000000000000000000000000000000",
    srcChainTokenInAmount: "200000000000000000", // 1 MATIC
    srcChainTokenInMinAmount: "200000000000000000",
    srcChainTokenInMaxAmount: "200000000000000000",
    dstChainId: 56,
    dstChainTokenOut: "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d",
    dstChainTokenOutAmount: "auto",
    srcChainAuthorityAddress: signer,
    dstChainTokenOutRecipient: signer,
    dstChainAuthorityAddress: signer,

    prependOperatingExpenses: true,
  }
}

export function getOptimismEthToBscWbnb(signer: string) {
  return {
    srcChainId: 10,
    srcChainTokenIn: "0x0000000000000000000000000000000000000000",
    srcChainTokenInAmount: "50000000000000", // 1 MATIC
    srcChainTokenInMinAmount: "50000000000000",
    srcChainTokenInMaxAmount: "50000000000000",
    dstChainId: 56,
    dstChainTokenOut: "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d",
    dstChainTokenOutAmount: "auto",
    srcChainAuthorityAddress: signer,
    dstChainTokenOutRecipient: signer,
    dstChainAuthorityAddress: signer,

    prependOperatingExpenses: true,
  }
}

export function getArbitrumEthToBscWbnb(signer: string) {
  return {
    srcChainId: arbitrum.id,
    srcChainTokenIn: "0x0000000000000000000000000000000000000000",
    srcChainTokenInAmount: "50000000000000", // 1 MATIC
    srcChainTokenInMinAmount: "50000000000000",
    srcChainTokenInMaxAmount: "50000000000000",
    dstChainId: 56,
    dstChainTokenOut: "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d",
    dstChainTokenOutAmount: "auto",
    srcChainAuthorityAddress: signer,
    dstChainTokenOutRecipient: signer,
    dstChainAuthorityAddress: signer,

    prependOperatingExpenses: true,
  }
}


export function getBaseEthToBscWbnb(signer: string) {
  return {
    srcChainId: 8453,
    srcChainTokenIn: "0x0000000000000000000000000000000000000000",
    srcChainTokenInAmount: "20000000000000", // 1 MATIC
    srcChainTokenInMinAmount: "20000000000000",
    srcChainTokenInMaxAmount: "20000000000000",
    dstChainId: 56,
    dstChainTokenOut: "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d",
    dstChainTokenOutAmount: "auto",
    srcChainAuthorityAddress: signer,
    dstChainTokenOutRecipient: signer,
    dstChainAuthorityAddress: signer,

    prependOperatingExpenses: true,
  }
}

export function getPolyMaticToBscBnb(signer: string) {
  return {
    srcChainId: 137,
    srcChainTokenIn: "0x0000000000000000000000000000000000000000",
    srcChainTokenInAmount: "200000000000000000", // 1 MATIC
    srcChainTokenInMinAmount: "200000000000000000",
    srcChainTokenInMaxAmount: "200000000000000000",
    dstChainId: 56,
    dstChainTokenOut: "0x0000000000000000000000000000000000000000",
    dstChainTokenOutAmount: "auto",
    srcChainAuthorityAddress: signer,
    dstChainTokenOutRecipient: signer,
    dstChainAuthorityAddress: signer,

    prependOperatingExpenses: false,
  }
}

export function getPolyMaticToBscUsdc(signer: string) {
  return {
    srcChainId: 137,
    srcChainTokenIn: "0x0000000000000000000000000000000000000000",
    srcChainTokenInAmount: "200000000000000000",
    srcChainTokenInMinAmount: "200000000000000000",
    srcChainTokenInMaxAmount: "200000000000000000",
    dstChainId: 56,
    dstChainTokenOut: "0x0000000000000000000000000000000000000000",
    dstChainTokenOutAmount: "auto",
    srcChainAuthorityAddress: signer,
    dstChainTokenOutRecipient: signer,
    dstChainAuthorityAddress: signer,

    prependOperatingExpenses: false,
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

export function getPolyUsdcToPolyWETH(signer: string) {
  return {
    "chainId": 137,
    "tokenIn": "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
    "tokenInAmount": "100000",
    "tokenInMinAmount": "100000",
    "tokenInMaxAmount": "100000",
    "tokenOut": "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
    "tokenOutRecipient": signer,
    "authorityAddress": signer,
    "affiliateFeePercent": null,
    "affiliateFeeRecipient": null,
    "prependOperatingExpenses": false
  };
}

export function getBscNativeToBaseUsdc(signer: string) {
  return {
    srcChainId: 56,
    srcChainTokenIn: "0x0000000000000000000000000000000000000000",
    srcChainTokenInAmount: "100000000000000",
    srcChainTokenInMinAmount: "100000000000000",
    srcChainTokenInMaxAmount: "100000000000000",
    dstChainId: 8453,
    dstChainTokenOut: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
    dstChainTokenOutAmount: "auto",
    srcChainAuthorityAddress: signer,
    dstChainTokenOutRecipient: signer,
    dstChainAuthorityAddress: signer,
    prependOperatingExpenses: true,
  }
}

export function getPolyLinkToBaseUsdc(signer: string) {
  return {
    srcChainId: 137,
    srcChainTokenIn: "0x53e0bca35ec356bd5dddfebbd1fc0fd03fabad39",
    srcChainTokenInAmount: (10**17).toString(),
    srcChainTokenInMinAmount: (10**17).toString(),
    srcChainTokenInMaxAmount: (10**17).toString(),
    dstChainId: 8453,
    dstChainTokenOut: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
    dstChainTokenOutAmount: "auto",
    srcChainAuthorityAddress: signer,
    dstChainTokenOutRecipient: '0xd14f5Ef6ec3E98922E2EE4942c89e575aF574BC7',
    dstChainAuthorityAddress: '0xd14f5Ef6ec3E98922E2EE4942c89e575aF574BC7',
    prependOperatingExpenses: true,
  }
}

export function getPolyMaticToBaseUsdc(signer: string) {
  return {
    srcChainId: 137,
    srcChainTokenIn: "0x0000000000000000000000000000000000000000",
    srcChainTokenInAmount: "200000000000000000",
    srcChainTokenInMinAmount: "200000000000000000",
    srcChainTokenInMaxAmount: "200000000000000000",
    dstChainId: 8453,
    dstChainTokenOut: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
    dstChainTokenOutAmount: "auto",
    srcChainAuthorityAddress: signer,
    dstChainTokenOutRecipient: '0xd14f5Ef6ec3E98922E2EE4942c89e575aF574BC7',
    dstChainAuthorityAddress: '0xd14f5Ef6ec3E98922E2EE4942c89e575aF574BC7',
    prependOperatingExpenses: true,
  }
}

export function getBaseEthToBaseUsdc(signer: string) {
  return {
    chainId: 8453,
    tokenIn: "0x0000000000000000000000000000000000000000",
    tokenInAmount: (10**14).toString(),
    tokenInMinAmount: (10**14).toString(),
    tokenInMaxAmount: (10**14).toString(),
    tokenOut: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
    tokenOutRecipient: signer,
    authorityAddress: signer,
    prependOperatingExpenses: true,
  }
}


export function getBaseDegenToBaseUsdc(signer: string) {
  return {
    chainId: 8453,
    tokenIn: "0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed",
    tokenInAmount: (10**18).toString(),
    tokenInMinAmount: (10**18).toString(),
    tokenInMaxAmount: (10**18).toString(),
    tokenOut: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
    tokenOutRecipient: signer,
    authorityAddress: signer,
    prependOperatingExpenses: true,
  }
}

export function getArbitrumEthToUsde(signer: string) {
  return {
    chainId: arbitrum.id,
    tokenIn: "0x0000000000000000000000000000000000000000",
    tokenInAmount: (10**14).toString(),
    tokenInMinAmount: (10**14).toString(),
    tokenInMaxAmount: (10**14).toString(),
    tokenOut: "0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f",
    tokenOutRecipient: signer,
    authorityAddress: signer,
    prependOperatingExpenses: true,
  }
}

export function getOptimismEthToRandomToken(signer: string) {
  return {
    chainId: 10,
    tokenIn: "0x0000000000000000000000000000000000000000",
    tokenInAmount: (10**14).toString(),
    tokenInMinAmount: (10**14).toString(),
    tokenInMaxAmount: (10**14).toString(),
    tokenOut: "0x8c6f28f2f1a3c87f0f938b96d27520d9751ec8d9",
    tokenOutRecipient: signer,
    authorityAddress: signer,
    prependOperatingExpenses: true,
  }
}

export function getArbitrumEthToBaseEth(signer: string) {
  return {
    srcChainId: arbitrum.id,
    srcChainTokenIn: "0x0000000000000000000000000000000000000000",
    srcChainTokenInAmount: "50000000000000",
    srcChainTokenInMinAmount: "50000000000000",
    srcChainTokenInMaxAmount: "50000000000000",
    dstChainId: 8453,
    dstChainTokenOut: "0x0000000000000000000000000000000000000000",
    dstChainTokenOutAmount: "auto",
    srcChainAuthorityAddress: signer,
    dstChainTokenOutRecipient: signer,
    dstChainAuthorityAddress: signer,
    prependOperatingExpenses: true,
  }
}

export function getOptimismEthToBaseEth(signer: string) {
  return {
    srcChainId: 10,
    srcChainTokenIn: "0x0000000000000000000000000000000000000000",
    srcChainTokenInAmount: "50000000000000",
    srcChainTokenInMinAmount: "50000000000000",
    srcChainTokenInMaxAmount: "50000000000000",
    dstChainId: 8453,
    dstChainTokenOut: "0xc729777d0470f30612b1564fd96e8dd26f5814e3",
    dstChainTokenOutAmount: "auto",
    srcChainAuthorityAddress: signer,
    dstChainTokenOutRecipient: signer,
    dstChainAuthorityAddress: signer,
    prependOperatingExpenses: true,
  }
}