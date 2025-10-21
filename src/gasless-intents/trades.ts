import {arbitrum} from "viem/chains";
import { CrossChainTrade, SameChainTrade } from "./types";
import { EVM_NATIVE_TOKEN, LINK, USDC, USDT, WBNB, WETH } from "../utils/constants";

export function getPolyUsdcToBscUsdcTrade(signer: string): CrossChainTrade {
  return {
    srcChainId: 137,
    srcChainTokenIn: USDC.Polygon, // USDC on Polygon (bridged), 6 decimals
    srcChainTokenInAmount: (10**5).toString(),      
    srcChainTokenInMinAmount: (10**5).toString(),   
    srcChainTokenInMaxAmount: (10**5).toString(),  

    // Destination (BSC)
    dstChainId: 56,
    dstChainTokenOut: USDC.BNB, 
    dstChainTokenOutAmount: "auto",
    dstChainTokenOutRecipient: signer,

    // Authorities 
    srcChainAuthorityAddress: signer,
    dstChainAuthorityAddress: signer,

    // Flags
    prependOperatingExpenses: true,
  }
}

export function getPolyUsdcToBscWbnbTrade(signer: string): CrossChainTrade {
  return {
    srcChainId: 137,
    srcChainTokenIn: USDC.Polygon, // USDC on Polygon
    srcChainTokenInAmount: "4000000", // 4 USDC
    srcChainTokenInMinAmount: "2000000",
    srcChainTokenInMaxAmount: "3000000",
    dstChainId: 56,
    dstChainTokenOut: WBNB.BNB, // WBNB on BSC
    dstChainTokenOutAmount: "auto",
    dstChainTokenOutRecipient: signer,
    srcChainAuthorityAddress: signer,
    dstChainAuthorityAddress: signer,
    prependOperatingExpenses: false,
  }
}

export function getPolyMaticToWethTrade(signer: string): SameChainTrade {
  return {
    // Same-chain swap
    chainId: 137,
    tokenIn: EVM_NATIVE_TOKEN,
    tokenInAmount: "100000000000000000", // 1 MATIC
    tokenInMinAmount: "100000000000000000",
    tokenInMaxAmount: "100000000000000000",
    tokenOut: WETH.Polygon,
    tokenOutRecipient: signer,
    authorityAddress: signer,
    prependOperatingExpenses: true,
  }
}

export function getBscNativeToUsdc(signer: string): SameChainTrade {
  return {
    // Same-chain swap
    chainId: 56,
    tokenIn: EVM_NATIVE_TOKEN,
    tokenInAmount: "100000000000000", // 1 MATIC
    tokenInMinAmount: "100000000000000",
    tokenInMaxAmount: "100000000000000",
    tokenOut: USDC.BNB,
    tokenOutRecipient: signer,
    authorityAddress: signer,
    prependOperatingExpenses: true,
  }
}

export function getBscNativeToPolNativeTrade(signer: string): CrossChainTrade {
  return {
    srcChainId: 56,
    srcChainTokenIn: EVM_NATIVE_TOKEN, // USDC on Polygon (bridged), 6 decimals
    srcChainTokenInAmount: "1000000000000000",      // 4$ USDC
    srcChainTokenInMinAmount: "1000000000000000",   // 2$ USDC
    srcChainTokenInMaxAmount: "1000000000000000",   // 3$ USDC

    // Destination (BSC)
    dstChainId: 10,
    dstChainTokenOut: EVM_NATIVE_TOKEN, // EVM_NATIVE_TOKEN, // USDC on BSC, 6 decimals
    dstChainTokenOutAmount: "auto",
    dstChainTokenOutRecipient: signer,

    // Authorities
    srcChainAuthorityAddress: signer,
    dstChainAuthorityAddress: signer,

    // Flags
    prependOperatingExpenses: true,
  }
}


export function getPolyMaticToBscWbnb(signer: string): CrossChainTrade {
  return {
    srcChainId: 137,
    srcChainTokenIn: EVM_NATIVE_TOKEN,
    srcChainTokenInAmount: "200000000000000000", // 1 MATIC
    srcChainTokenInMinAmount: "200000000000000000",
    srcChainTokenInMaxAmount: "200000000000000000",
    dstChainId: 56,
    dstChainTokenOut: WBNB.BNB,
    dstChainTokenOutAmount: "auto",
    srcChainAuthorityAddress: signer,
    dstChainTokenOutRecipient: signer,
    dstChainAuthorityAddress: signer,

    prependOperatingExpenses: true,
  }
}

export function getOptimismEthToBscWbnb(signer: string): CrossChainTrade {
  return {
    srcChainId: 10,
    srcChainTokenIn: EVM_NATIVE_TOKEN,
    srcChainTokenInAmount: "50000000000000", // 1 MATIC
    srcChainTokenInMinAmount: "50000000000000",
    srcChainTokenInMaxAmount: "50000000000000",
    dstChainId: 56,
    dstChainTokenOut: WBNB.BNB,
    dstChainTokenOutAmount: "auto",
    srcChainAuthorityAddress: signer,
    dstChainTokenOutRecipient: signer,
    dstChainAuthorityAddress: signer,

    prependOperatingExpenses: true,
  }
}

export function getArbitrumEthToBscWbnb(signer: string): CrossChainTrade {
  return {
    srcChainId: arbitrum.id,
    srcChainTokenIn: EVM_NATIVE_TOKEN,
    srcChainTokenInAmount: "50000000000000", // 1 MATIC
    srcChainTokenInMinAmount: "50000000000000",
    srcChainTokenInMaxAmount: "50000000000000",
    dstChainId: 56,
    dstChainTokenOut: WBNB.BNB,
    dstChainTokenOutAmount: "auto",
    srcChainAuthorityAddress: signer,
    dstChainTokenOutRecipient: signer,
    dstChainAuthorityAddress: signer,

    prependOperatingExpenses: true,
  }
}


export function getBaseEthToBscWbnb(signer: string): CrossChainTrade {
  return {
    srcChainId: 8453,
    srcChainTokenIn: EVM_NATIVE_TOKEN,
    srcChainTokenInAmount: "20000000000000", // 1 MATIC
    srcChainTokenInMinAmount: "20000000000000",
    srcChainTokenInMaxAmount: "20000000000000",
    dstChainId: 56,
    dstChainTokenOut: WBNB.BNB,
    dstChainTokenOutAmount: "auto",
    srcChainAuthorityAddress: signer,
    dstChainTokenOutRecipient: signer,
    dstChainAuthorityAddress: signer,

    prependOperatingExpenses: true,
  }
}

export function getPolyMaticToBscBnb(signer: string): CrossChainTrade {
  return {
    srcChainId: 137,
    srcChainTokenIn: EVM_NATIVE_TOKEN,
    srcChainTokenInAmount: "200000000000000000", // 1 MATIC
    srcChainTokenInMinAmount: "200000000000000000",
    srcChainTokenInMaxAmount: "200000000000000000",
    dstChainId: 56,
    dstChainTokenOut: EVM_NATIVE_TOKEN,
    dstChainTokenOutAmount: "auto",
    srcChainAuthorityAddress: signer,
    dstChainTokenOutRecipient: signer,
    dstChainAuthorityAddress: signer,

    prependOperatingExpenses: true,
  }
}

export function getPolyMaticToBscBnbStuck(signer: string): CrossChainTrade {
  return {
    srcChainId: 137,
    srcChainTokenIn: EVM_NATIVE_TOKEN,
    srcChainTokenInAmount: "200000000000000000", // 1 MATIC
    srcChainTokenInMinAmount: "200000000000000000",
    srcChainTokenInMaxAmount: "200000000000000000",
    dstChainId: 56,
    dstChainTokenOut: EVM_NATIVE_TOKEN,
    dstChainTokenOutAmount: "1000000000000000000", // 1 BNB
    srcChainAuthorityAddress: signer,
    dstChainTokenOutRecipient: signer,
    dstChainAuthorityAddress: signer,

    prependOperatingExpenses: true,
  }
}

export function getPolyMaticToBscUsdc(signer: string): CrossChainTrade {
  return {
    srcChainId: 137,
    srcChainTokenIn: EVM_NATIVE_TOKEN,
    srcChainTokenInAmount: "200000000000000000",
    srcChainTokenInMinAmount: "200000000000000000",
    srcChainTokenInMaxAmount: "200000000000000000",
    dstChainId: 56,
    dstChainTokenOut: USDC.BNB,
    dstChainTokenOutAmount: "auto",
    srcChainAuthorityAddress: signer,
    dstChainTokenOutRecipient: signer,
    dstChainAuthorityAddress: signer,

    prependOperatingExpenses: false,
  }
}

export function getPolyUsdcToBscUsdt(signer: string): CrossChainTrade {
  return {
    // USDC (Polygon) -> USDT (BSC)
    srcChainId: 137,
    srcChainTokenIn: USDC.Polygon, // USDC on Polygon
    srcChainTokenInAmount: "11000000", // 11 USDC
    srcChainTokenInMinAmount: "9000000",
    srcChainTokenInMaxAmount: "10000000",
    dstChainId: 56,
    dstChainTokenOut: USDT.BNB, // USDT on BSC
    dstChainTokenOutAmount: "auto",
    dstChainTokenOutRecipient: signer,
    srcChainAuthorityAddress: signer,
    dstChainAuthorityAddress: signer,
    prependOperatingExpenses: false
  }
}

export function getPolyMaticToBscUsdt(signer: string): CrossChainTrade {
  return {
    // MATIC (Polygon) -> USDT (BSC)
    srcChainId: 137,
    srcChainTokenIn: EVM_NATIVE_TOKEN, // native MATIC
    srcChainTokenInAmount: "11000000000000000000", // 11 MATIC
    srcChainTokenInMinAmount: "9000000000000000000",
    srcChainTokenInMaxAmount: "10000000000000000000",
    dstChainId: 56,
    dstChainTokenOut: USDT.BNB,
    dstChainTokenOutAmount: "auto",
    dstChainTokenOutRecipient: signer,
    srcChainAuthorityAddress: signer,
    dstChainAuthorityAddress: signer,
    prependOperatingExpenses: false
  }
}

export function getPolyUsdtToBscUsdt(signer: string): CrossChainTrade {
  return {
    // USDT (Polygon) -> USDT (BSC)
    srcChainId: 137,
    srcChainTokenIn: USDT.Polygon, // USDT on Polygon
    srcChainTokenInAmount: "10000000", // 10 USDT
    srcChainTokenInMinAmount: "10000000",
    srcChainTokenInMaxAmount: "10000000",
    dstChainId: 56,
    dstChainTokenOut: USDT.BNB,
    dstChainTokenOutAmount: "auto",
    dstChainTokenOutRecipient: signer,
    srcChainAuthorityAddress: signer,
    dstChainAuthorityAddress: signer,
    prependOperatingExpenses: false
  }
}

export function getPolyUsdcToPolyWETH(signer: string): SameChainTrade {
  return {
    chainId: 137,
    tokenIn: USDC.Polygon,
    tokenInAmount: "100000",
    tokenInMinAmount: "100000",
    tokenInMaxAmount: "100000",
    tokenOut: WETH.Polygon,
    tokenOutRecipient: signer,
    authorityAddress: signer,
    affiliateFeePercent: null,
    affiliateFeeRecipient: null,
    prependOperatingExpenses: false
  };
}

export function getBscNativeToBaseUsdc(signer: string): CrossChainTrade {
  return {
    srcChainId: 56,
    srcChainTokenIn: EVM_NATIVE_TOKEN,
    srcChainTokenInAmount: "100000000000000",
    srcChainTokenInMinAmount: "100000000000000",
    srcChainTokenInMaxAmount: "100000000000000",
    dstChainId: 8453,
    dstChainTokenOut: USDC.Base,
    dstChainTokenOutAmount: "auto",
    srcChainAuthorityAddress: signer,
    dstChainTokenOutRecipient: signer,
    dstChainAuthorityAddress: signer,
    prependOperatingExpenses: true,
  }
}

export function getPolyLinkToBaseUsdc(signer: string): CrossChainTrade {
  return {
    srcChainId: 137,
    srcChainTokenIn: LINK.Polygon,
    srcChainTokenInAmount: (10**17).toString(),
    srcChainTokenInMinAmount: (10**17).toString(),
    srcChainTokenInMaxAmount: (10**17).toString(),
    dstChainId: 8453,
    dstChainTokenOut: USDC.Base,
    dstChainTokenOutAmount: "auto",
    srcChainAuthorityAddress: signer,
    dstChainTokenOutRecipient: signer,
    dstChainAuthorityAddress: signer,
    prependOperatingExpenses: true,
  }
}

export function getPolyMaticToBaseUsdc(signer: string): CrossChainTrade {
  return {
    srcChainId: 137,
    srcChainTokenIn: EVM_NATIVE_TOKEN,
    srcChainTokenInAmount: "2000000000000000000", // 2 MATIC
    srcChainTokenInMinAmount: "2000000000000000000",
    srcChainTokenInMaxAmount: "2000000000000000000",
    dstChainId: 8453,
    dstChainTokenOut: USDC.Base,
    dstChainTokenOutAmount: "auto",
    srcChainAuthorityAddress: signer,
    dstChainTokenOutRecipient: signer,
    dstChainAuthorityAddress: signer,
    prependOperatingExpenses: true,
  }
}

export function getBaseEthToBaseUsdc(signer: string): SameChainTrade {
  return {
    chainId: 8453,
    tokenIn: EVM_NATIVE_TOKEN,
    tokenInAmount: (10**14).toString(),
    tokenInMinAmount: (10**14).toString(),
    tokenInMaxAmount: (10**14).toString(),
    tokenOut: USDC.Base,
    tokenOutRecipient: signer,
    authorityAddress: signer,
    prependOperatingExpenses: true,
  }
}


export function getBaseDegenToBaseUsdc(signer: string): SameChainTrade {
  return {
    chainId: 8453,
    tokenIn: "0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed",
    tokenInAmount: (10**18).toString(),
    tokenInMinAmount: (10**18).toString(),
    tokenInMaxAmount: (10**18).toString(),
    tokenOut: USDC.Base,
    tokenOutRecipient: signer,
    authorityAddress: signer,
    prependOperatingExpenses: true,
  }
}

export function getArbitrumEthToUsde(signer: string): SameChainTrade {
  return {
    chainId: arbitrum.id,
    tokenIn: EVM_NATIVE_TOKEN,
    tokenInAmount: (10**14).toString(),
    tokenInMinAmount: (10**14).toString(),
    tokenInMaxAmount: (10**14).toString(),
    tokenOut: "0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f",
    tokenOutRecipient: signer,
    authorityAddress: signer,
    prependOperatingExpenses: true,
  }
}

export function getOptimismEthToRandomToken(signer: string): SameChainTrade {
  return {
    chainId: 10,
    tokenIn: EVM_NATIVE_TOKEN,
    tokenInAmount: (10**14).toString(),
    tokenInMinAmount: (10**14).toString(),
    tokenInMaxAmount: (10**14).toString(),
    tokenOut: "0x8c6f28f2f1a3c87f0f938b96d27520d9751ec8d9",
    tokenOutRecipient: signer,
    authorityAddress: signer,
    prependOperatingExpenses: true,
  }
}

export function getArbitrumEthToBaseEth(signer: string): CrossChainTrade {
  return {
    srcChainId: arbitrum.id,
    srcChainTokenIn: EVM_NATIVE_TOKEN,
    srcChainTokenInAmount: "50000000000000",
    srcChainTokenInMinAmount: "50000000000000",
    srcChainTokenInMaxAmount: "50000000000000",
    dstChainId: 8453,
    dstChainTokenOut: EVM_NATIVE_TOKEN,
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
    srcChainTokenIn: EVM_NATIVE_TOKEN,
    srcChainTokenInAmount: "50000000000000",
    srcChainTokenInMinAmount: "50000000000000",
    srcChainTokenInMaxAmount: "50000000000000",
    dstChainId: 8453,
    dstChainTokenOut: EVM_NATIVE_TOKEN,
    dstChainTokenOutAmount: "auto",
    srcChainAuthorityAddress: signer,
    dstChainTokenOutRecipient: signer,
    dstChainAuthorityAddress: signer,
    prependOperatingExpenses: true,
  }
}

export function getPolygonUsdcToBaseUsdc(signer: string): CrossChainTrade {
  return {
    srcChainId: 137,
    srcChainTokenIn: USDC.Polygon,
    srcChainTokenInAmount: "7000000",
    srcChainTokenInMinAmount: "7000000",
    srcChainTokenInMaxAmount: "7000000",
    dstChainId: 56,
    dstChainTokenOut: EVM_NATIVE_TOKEN,
    dstChainTokenOutAmount: "auto",
    srcChainAuthorityAddress: signer,
    dstChainTokenOutRecipient: signer,
    dstChainAuthorityAddress: signer,
    prependOperatingExpenses: true,
  }
}