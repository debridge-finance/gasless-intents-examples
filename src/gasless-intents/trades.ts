import { Trade } from "./types";
import { DAI, EVM_NATIVE_TOKEN, LINK, SOL_JUP, SOL_NATIVE, USDC, USDT, WBNB, WETH } from "../utils/constants";
import { CHAIN_IDS } from "../utils/chains";

export function getPolyUsdcToBscUsdcTrade(signer: string): Trade {
  return {
    srcChainId: CHAIN_IDS.Polygon,
    srcChainTokenIn: USDC.Polygon, // USDC on Polygon (bridged), 6 decimals
    srcChainTokenInAmount: "1000000", // 1 USDC
    srcChainTokenInMinAmount: "1000000",
    srcChainTokenInMaxAmount: "1000000",

    // Destination (BSC)
    dstChainId: CHAIN_IDS.BNB,
    dstChainTokenOut: USDC.BNB,
    dstChainTokenOutAmount: "auto",
    dstChainTokenOutRecipient: signer,

    // Authorities
    srcChainAuthorityAddress: signer,
    dstChainAuthorityAddress: signer,

    // Flags
    prependOperatingExpenses: true
  }
}

export function getPolyUsdcToSolUsdcTrade(signer: string, recipient: string, solanaAuthority: string): Trade {
  return {
    srcChainId: CHAIN_IDS.Polygon,
    srcChainTokenIn: USDC.Polygon, // USDC on Polygon (bridged), 6 decimals
    srcChainTokenInAmount: "100000",
    srcChainTokenInMinAmount: "100000",
    srcChainTokenInMaxAmount: "100000",

    // Destination (Solana)
    dstChainId: CHAIN_IDS.Solana,
    dstChainTokenOut: USDC.Solana, // USDC on Solana, 6 decimals
    dstChainTokenOutAmount: "auto",
    dstChainTokenOutRecipient: recipient,

    // Authorities
    srcChainAuthorityAddress: signer,
    dstChainAuthorityAddress: solanaAuthority,

    // Flags
    prependOperatingExpenses: true,
  }
}

export function getSolUsdcToBscUsdcTrade(signer: string, recipient: string): Trade {
  return {
    srcChainId: CHAIN_IDS.Solana,
    srcChainTokenIn: USDC.Solana, // USDC on Polygon (bridged), 6 decimals

    srcChainTokenInAmount: "10000000",      // 10$ USDC
    srcChainTokenInMinAmount: "10000000",   // 1$ USDC
    srcChainTokenInMaxAmount: "10000000",   // 1$ USDC

    // Destination (POL)
    dstChainId: CHAIN_IDS.BNB,
    dstChainTokenOut: USDC.BNB, // USDC on BSC, 6 decimals
    dstChainTokenOutAmount: "auto",
    dstChainTokenOutRecipient: recipient,

    // Authorities
    srcChainAuthorityAddress: signer,
    dstChainAuthorityAddress: recipient,

    // Flags
    // prependOperatingExpenses: true,
    prependOperatingExpenses: false,
  }
}

export function getSolUsdcToPolyUsdcTrade(signer: string, recipient: string): Trade {
  return {
    srcChainId: CHAIN_IDS.Solana,
    srcChainTokenIn: USDC.Solana, // USDC on Polygon (bridged), 6 decimals

    srcChainTokenInAmount: "5000000",      // 5$ USDC
    srcChainTokenInMinAmount: "5000000",   // 5$ USDC
    srcChainTokenInMaxAmount: "5000000",   // 5$ USDC

    // Destination (POL)
    dstChainId: CHAIN_IDS.Polygon,
    dstChainTokenOut: USDC.Polygon, // USDC on BSC, 6 decimals
    dstChainTokenOutAmount: "auto",
    dstChainTokenOutRecipient: recipient,

    // Authorities
    srcChainAuthorityAddress: signer,
    dstChainAuthorityAddress: recipient,

    // Flags
    // prependOperatingExpenses: true,
    prependOperatingExpenses: true,
  }
}

export function getSolUsdcToPolUsdcTrade(signer: string, recipient: string): Trade {
  return {
    srcChainId: CHAIN_IDS.Solana,
    srcChainTokenIn: USDC.Solana, // USDC on Polygon (bridged), 6 decimals

    srcChainTokenInAmount: "4000000",
    srcChainTokenInMinAmount: "4000000",
    srcChainTokenInMaxAmount: "4000000",

    // Destination (POL)
    dstChainId: CHAIN_IDS.Polygon,
    dstChainTokenOut: USDC.Polygon, // USDC on BSC, 6 decimals
    dstChainTokenOutAmount: "auto",
    dstChainTokenOutRecipient: recipient,

    // Authorities
    srcChainAuthorityAddress: signer,
    dstChainAuthorityAddress: recipient,

    // Flags
    // prependOperatingExpenses: true,
    prependOperatingExpenses: false,
  }
}

export function getWrapSolToBscUsdcTrade(signer: string, dstEvmChain: string): Trade {
  return {
    srcChainId: CHAIN_IDS.Solana,
    srcChainTokenIn: SOL_NATIVE,

    srcChainTokenInAmount: "21000000",
    srcChainTokenInMinAmount: "21000000",
    srcChainTokenInMaxAmount: "21000000",

    // Destination (BSC)
    dstChainId: CHAIN_IDS.BNB,
    dstChainTokenOut: USDC.BNB,
    dstChainTokenOutAmount: "auto",
    dstChainTokenOutRecipient: dstEvmChain,

    // Authorities
    srcChainAuthorityAddress: signer,
    dstChainAuthorityAddress: dstEvmChain,

    // Flags
    // prependOperatingExpenses: true,
    prependOperatingExpenses: true,
  }
}

export function getPolyUsdcToSolJupTrade(
  signerEvm: string,
  dstChainTokenOutRecipient: string,
  dstChainAuthorityAddress: string
): Trade {
  return {
    srcChainId: CHAIN_IDS.Polygon,
    srcChainTokenIn: USDC.Polygon, // USDC on Polygon (bridged), 6 decimals
    srcChainTokenInAmount: "4000000",      // 4$ USDC
    srcChainTokenInMinAmount: "4000000",   // 2$ USDC
    srcChainTokenInMaxAmount: "4000000",   // 3$ USDC

    dstChainId: CHAIN_IDS.Solana,
    dstChainTokenOut: SOL_JUP,
    dstChainTokenOutAmount: "auto",
    dstChainTokenOutRecipient: dstChainTokenOutRecipient,

    // Authorities
    srcChainAuthorityAddress: signerEvm,
    dstChainAuthorityAddress: dstChainAuthorityAddress,

    // Flags
    prependOperatingExpenses: true,
  }
}

export function getPolyUsdcToBscWbnbTrade(signer: string): Trade {
  return {
    srcChainId: CHAIN_IDS.Polygon,
    srcChainTokenIn: USDC.Polygon, // USDC on Polygon
    srcChainTokenInAmount: "4000000", // 4 USDC
    srcChainTokenInMinAmount: "2000000",
    srcChainTokenInMaxAmount: "3000000",
    dstChainId: CHAIN_IDS.BNB,
    dstChainTokenOut: WBNB.BNB, // WBNB on BSC
    dstChainTokenOutAmount: "auto",
    dstChainTokenOutRecipient: signer,
    srcChainAuthorityAddress: signer,
    dstChainAuthorityAddress: signer,
    prependOperatingExpenses: false,
  }
}

export function getPolyMaticToWethTrade(signer: string): Trade {
  return {
    srcChainId: CHAIN_IDS.Polygon,
    srcChainTokenIn: EVM_NATIVE_TOKEN,
    srcChainTokenInAmount: "100000000000000000",
    srcChainTokenInMinAmount: "100000000000000000",
    srcChainTokenInMaxAmount: "100000000000000000",
    srcChainAuthorityAddress: signer,
    dstChainId: CHAIN_IDS.Polygon,
    dstChainTokenOut: WETH.Polygon,
    dstChainTokenOutAmount: "auto",
    dstChainTokenOutRecipient: signer,
    dstChainAuthorityAddress: signer,
    prependOperatingExpenses: true
  }
}

export function getPolyMaticToArbitrumUsdc(signer: string): Trade {
  return {
    srcChainId: CHAIN_IDS.Polygon,
    srcChainTokenIn: EVM_NATIVE_TOKEN,
    srcChainTokenInAmount: "100000000000000000",
    srcChainTokenInMinAmount: "100000000000000000",
    srcChainTokenInMaxAmount: "100000000000000000",
    srcChainAuthorityAddress: signer,
    dstChainId: CHAIN_IDS.Arbitrum,
    dstChainTokenOut: USDC.Arbitrum,
    dstChainTokenOutAmount: "auto",
    dstChainTokenOutRecipient: signer,
    dstChainAuthorityAddress: signer,
    prependOperatingExpenses: true
  }
}

export function getPolyMaticToWethTradeV1_1(signer: string, recipient: string): Trade {
  return {
    srcChainId: CHAIN_IDS.Polygon,
    srcChainTokenIn: EVM_NATIVE_TOKEN,

    srcChainTokenInAmount: "100000000000000000",      // 1 MATIC
    srcChainTokenInMinAmount: "100000000000000000",   // 1 MATIC
    srcChainTokenInMaxAmount: "100000000000000000",   // 1 MATIC

    // Destination (POL)
    dstChainId: CHAIN_IDS.Polygon,
    dstChainTokenOut: WETH.Polygon,
    dstChainTokenOutAmount: "auto",
    dstChainTokenOutRecipient: recipient,

    // Authorities
    srcChainAuthorityAddress: signer,
    dstChainAuthorityAddress: recipient,

    // Flags
    // prependOperatingExpenses: true,
    prependOperatingExpenses: true,
  }
}

export function getBscNativeToUsdc(signer: string): Trade {
  return {
    srcChainId: CHAIN_IDS.BNB,
    srcChainTokenIn: EVM_NATIVE_TOKEN,
    srcChainTokenInAmount: "100000000000000", // 0.0001 BNB
    srcChainTokenInMinAmount: "100000000000000",
    srcChainTokenInMaxAmount: "100000000000000",
    srcChainAuthorityAddress: signer,
    dstChainId: CHAIN_IDS.BNB,
    dstChainTokenOut: USDC.BNB,
    dstChainTokenOutAmount: "auto",
    dstChainTokenOutRecipient: signer,
    dstChainAuthorityAddress: signer,
    prependOperatingExpenses: true
  }
}

export function getBscNativeToPolNativeTrade(signer: string): Trade {
  return {
    srcChainId: CHAIN_IDS.BNB,
    srcChainTokenIn: EVM_NATIVE_TOKEN, // USDC on Polygon (bridged), 6 decimals
    srcChainTokenInAmount: "1000000000000000",      // 4$ USDC
    srcChainTokenInMinAmount: "1000000000000000",   // 2$ USDC
    srcChainTokenInMaxAmount: "1000000000000000",   // 3$ USDC

    // Destination (BSC)
    dstChainId: CHAIN_IDS.Optimism,
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


export function getPolyMaticToBscWbnb(signer: string): Trade {
  return {
    srcChainId: CHAIN_IDS.Polygon,
    srcChainTokenIn: EVM_NATIVE_TOKEN,
    srcChainTokenInAmount: "200000000000000000", // 1 MATIC
    srcChainTokenInMinAmount: "200000000000000000",
    srcChainTokenInMaxAmount: "200000000000000000",
    dstChainId: CHAIN_IDS.BNB,
    dstChainTokenOut: WBNB.BNB,
    dstChainTokenOutAmount: "auto",
    srcChainAuthorityAddress: signer,
    dstChainTokenOutRecipient: signer,
    dstChainAuthorityAddress: signer,

    prependOperatingExpenses: true,
  }
}

export function getOptimismEthToBscWbnb(signer: string): Trade {
  return {
    srcChainId: CHAIN_IDS.Optimism,
    srcChainTokenIn: EVM_NATIVE_TOKEN,
    srcChainTokenInAmount: "50000000000000", // 1 MATIC
    srcChainTokenInMinAmount: "50000000000000",
    srcChainTokenInMaxAmount: "50000000000000",
    dstChainId: CHAIN_IDS.BNB,
    dstChainTokenOut: WBNB.BNB,
    dstChainTokenOutAmount: "auto",
    srcChainAuthorityAddress: signer,
    dstChainTokenOutRecipient: signer,
    dstChainAuthorityAddress: signer,

    prependOperatingExpenses: true,
  }
}

export function getArbitrumEthToBscWbnb(signer: string): Trade {
  return {
    srcChainId: CHAIN_IDS.Arbitrum,
    srcChainTokenIn: EVM_NATIVE_TOKEN,
    srcChainTokenInAmount: "50000000000000", // 1 MATIC
    srcChainTokenInMinAmount: "50000000000000",
    srcChainTokenInMaxAmount: "50000000000000",
    dstChainId: CHAIN_IDS.BNB,
    dstChainTokenOut: WBNB.BNB,
    dstChainTokenOutAmount: "auto",
    srcChainAuthorityAddress: signer,
    dstChainTokenOutRecipient: signer,
    dstChainAuthorityAddress: signer,

    prependOperatingExpenses: true,
  }
}


export function getBaseEthToBscWbnb(signer: string): Trade {
  return {
    srcChainId: CHAIN_IDS.Base,
    srcChainTokenIn: EVM_NATIVE_TOKEN,
    srcChainTokenInAmount: "20000000000000", // 1 MATIC
    srcChainTokenInMinAmount: "20000000000000",
    srcChainTokenInMaxAmount: "20000000000000",
    dstChainId: CHAIN_IDS.BNB,
    dstChainTokenOut: WBNB.BNB,
    dstChainTokenOutAmount: "auto",
    srcChainAuthorityAddress: signer,
    dstChainTokenOutRecipient: signer,
    dstChainAuthorityAddress: signer,

    prependOperatingExpenses: true,
  }
}

export function getPolyMaticToBscBnb(signer: string): Trade {
  return {
    srcChainId: CHAIN_IDS.Polygon,
    srcChainTokenIn: EVM_NATIVE_TOKEN,
    srcChainTokenInAmount: "200000000000000000", // 2 MATIC
    srcChainTokenInMinAmount: "200000000000000000",
    srcChainTokenInMaxAmount: "200000000000000000",
    dstChainId: CHAIN_IDS.BNB,
    dstChainTokenOut: EVM_NATIVE_TOKEN,
    dstChainTokenOutAmount: "auto",
    srcChainAuthorityAddress: signer,
    dstChainTokenOutRecipient: signer,
    dstChainAuthorityAddress: signer,

    prependOperatingExpenses: true,
  }
}

export function getPolyMaticToBscBnbStuck(signer: string): Trade {
  return {
    srcChainId: CHAIN_IDS.Polygon,
    srcChainTokenIn: EVM_NATIVE_TOKEN,
    srcChainTokenInAmount: "200000000000000000", // 1 MATIC
    srcChainTokenInMinAmount: "200000000000000000",
    srcChainTokenInMaxAmount: "200000000000000000",
    dstChainId: CHAIN_IDS.BNB,
    dstChainTokenOut: EVM_NATIVE_TOKEN,
    dstChainTokenOutAmount: "1000000000000000000", // 1 BNB
    srcChainAuthorityAddress: signer,
    dstChainTokenOutRecipient: signer,
    dstChainAuthorityAddress: signer,

    prependOperatingExpenses: true,
  }
}

export function getPolyMaticToBscUsdc(signer: string): Trade {
  return {
    srcChainId: CHAIN_IDS.Polygon,
    srcChainTokenIn: EVM_NATIVE_TOKEN,
    srcChainTokenInAmount: "200000000000000000",
    srcChainTokenInMinAmount: "200000000000000000",
    srcChainTokenInMaxAmount: "200000000000000000",
    dstChainId: CHAIN_IDS.BNB,
    dstChainTokenOut: USDC.BNB,
    dstChainTokenOutAmount: "auto",
    srcChainAuthorityAddress: signer,
    dstChainTokenOutRecipient: signer,
    dstChainAuthorityAddress: signer,

    prependOperatingExpenses: false,
  }
}

export function getPolyUsdcToBscUsdt(signer: string): Trade {
  return {
    // USDC (Polygon) -> USDT (BSC)
    srcChainId: CHAIN_IDS.Polygon,
    srcChainTokenIn: USDC.Polygon, // USDC on Polygon
    srcChainTokenInAmount: "11000000", // 11 USDC
    srcChainTokenInMinAmount: "9000000",
    srcChainTokenInMaxAmount: "10000000",
    dstChainId: CHAIN_IDS.BNB,
    dstChainTokenOut: USDT.BNB, // USDT on BSC
    dstChainTokenOutAmount: "auto",
    dstChainTokenOutRecipient: signer,
    srcChainAuthorityAddress: signer,
    dstChainAuthorityAddress: signer,
    prependOperatingExpenses: false
  }
}

export function getPolyMaticToBscUsdt(signer: string): Trade {
  return {
    // MATIC (Polygon) -> USDT (BSC)
    srcChainId: CHAIN_IDS.Polygon,
    srcChainTokenIn: EVM_NATIVE_TOKEN, // native MATIC
    srcChainTokenInAmount: "11000000000000000000", // 11 MATIC
    srcChainTokenInMinAmount: "9000000000000000000",
    srcChainTokenInMaxAmount: "10000000000000000000",
    dstChainId: CHAIN_IDS.BNB,
    dstChainTokenOut: USDT.BNB,
    dstChainTokenOutAmount: "auto",
    dstChainTokenOutRecipient: signer,
    srcChainAuthorityAddress: signer,
    dstChainAuthorityAddress: signer,
    prependOperatingExpenses: false
  }
}

export function getPolyUsdtToBscUsdt(signer: string): Trade {
  return {
    // USDT (Polygon) -> USDT (BSC)
    srcChainId: CHAIN_IDS.Polygon,
    srcChainTokenIn: USDT.Polygon, // USDT on Polygon
    srcChainTokenInAmount: "10000000", // 10 USDT
    srcChainTokenInMinAmount: "10000000",
    srcChainTokenInMaxAmount: "10000000",
    dstChainId: CHAIN_IDS.BNB,
    dstChainTokenOut: USDT.BNB,
    dstChainTokenOutAmount: "auto",
    dstChainTokenOutRecipient: signer,
    srcChainAuthorityAddress: signer,
    dstChainAuthorityAddress: signer,
    prependOperatingExpenses: false
  }
}

export function getPolyUsdcToPolyWETH(signer: string): Trade {
  return {
    srcChainId: CHAIN_IDS.Polygon,
    srcChainTokenIn: USDC.Polygon,
    srcChainTokenInAmount: "100000",
    srcChainTokenInMinAmount: "100000",
    srcChainTokenInMaxAmount: "100000",
    srcChainAuthorityAddress: signer,
    dstChainId: CHAIN_IDS.Polygon,
    dstChainTokenOut: WETH.Polygon,
    dstChainTokenOutAmount: "auto",
    dstChainTokenOutRecipient: signer,
    dstChainAuthorityAddress: signer,
    prependOperatingExpenses: true,
    affiliateFeePercent: null,
    affiliateFeeRecipient: null,
  };
}

export function getBscNativeToBaseUsdc(signer: string): Trade {
  return {
    srcChainId: CHAIN_IDS.BNB,
    srcChainTokenIn: EVM_NATIVE_TOKEN,
    srcChainTokenInAmount: "100000000000000",
    srcChainTokenInMinAmount: "100000000000000",
    srcChainTokenInMaxAmount: "100000000000000",
    dstChainId: CHAIN_IDS.Base,
    dstChainTokenOut: USDC.Base,
    dstChainTokenOutAmount: "auto",
    srcChainAuthorityAddress: signer,
    dstChainTokenOutRecipient: signer,
    dstChainAuthorityAddress: signer,
    prependOperatingExpenses: true,
  }
}

export function getPolyLinkToBaseUsdc(signer: string): Trade {
  return {
    srcChainId: CHAIN_IDS.Polygon,
    srcChainTokenIn: LINK.Polygon,
    srcChainTokenInAmount: (10 ** 17).toString(),
    srcChainTokenInMinAmount: (10 ** 17).toString(),
    srcChainTokenInMaxAmount: (10 ** 17).toString(),
    dstChainId: CHAIN_IDS.Base,
    dstChainTokenOut: USDC.Base,
    dstChainTokenOutAmount: "auto",
    srcChainAuthorityAddress: signer,
    dstChainTokenOutRecipient: signer,
    dstChainAuthorityAddress: signer,
    prependOperatingExpenses: true,
  }
}

export function getPolyMaticToBaseUsdc(signer: string): Trade {
  return {
    srcChainId: CHAIN_IDS.Polygon,
    srcChainTokenIn: EVM_NATIVE_TOKEN,
    srcChainTokenInAmount: "2000000000000000000", // 2 MATIC
    srcChainTokenInMinAmount: "2000000000000000000",
    srcChainTokenInMaxAmount: "2000000000000000000",
    dstChainId: CHAIN_IDS.Base,
    dstChainTokenOut: USDC.Base,
    dstChainTokenOutAmount: "auto",
    srcChainAuthorityAddress: signer,
    dstChainTokenOutRecipient: signer,
    dstChainAuthorityAddress: signer,
    prependOperatingExpenses: true,
  }
}

export function getPolyMaticToBaseEth(signer: string): Trade {
  return {
    srcChainId: CHAIN_IDS.Polygon,
    srcChainTokenIn: EVM_NATIVE_TOKEN,
    srcChainTokenInAmount: "2000000000000000000", // 2 MATIC
    srcChainTokenInMinAmount: "2000000000000000000",
    srcChainTokenInMaxAmount: "2000000000000000000",
    dstChainId: CHAIN_IDS.Base,
    dstChainTokenOut: EVM_NATIVE_TOKEN,
    dstChainTokenOutAmount: "auto",
    srcChainAuthorityAddress: signer,
    dstChainTokenOutRecipient: signer,
    dstChainAuthorityAddress: signer,
    prependOperatingExpenses: true,
  }
}

export function getBaseEthToBaseUsdc(signer: string): Trade {
  return {
    srcChainId: CHAIN_IDS.Base,
    srcChainTokenIn: EVM_NATIVE_TOKEN,
    srcChainTokenInAmount: (10 ** 14).toString(),
    srcChainTokenInMinAmount: (10 ** 14).toString(),
    srcChainTokenInMaxAmount: (10 ** 14).toString(),
    srcChainAuthorityAddress: signer,
    dstChainId: CHAIN_IDS.Base,
    dstChainTokenOut: USDC.Base,
    dstChainTokenOutAmount: "auto",
    dstChainTokenOutRecipient: signer,
    dstChainAuthorityAddress: signer,
    prependOperatingExpenses: false
  }
}


export function getBaseDegenToBaseUsdc(signer: string): Trade {
  return {
    srcChainId: CHAIN_IDS.Base,
    srcChainTokenIn: "0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed",
    srcChainTokenInAmount: (10 ** 18).toString(),
    srcChainTokenInMinAmount: (10 ** 18).toString(),
    srcChainTokenInMaxAmount: (10 ** 18).toString(),
    srcChainAuthorityAddress: signer,
    dstChainId: CHAIN_IDS.Base,
    dstChainTokenOut: USDC.Base,
    dstChainTokenOutAmount: "auto",
    dstChainTokenOutRecipient: signer,
    dstChainAuthorityAddress: signer,
    prependOperatingExpenses: true,
  }
}

export function getArbitrumEthToWbtc(signer: string): Trade {
  return {
    srcChainId: CHAIN_IDS.Arbitrum,
    srcChainTokenIn: EVM_NATIVE_TOKEN,
    srcChainTokenInAmount: (10 ** 14).toString(),
    srcChainTokenInMinAmount: (10 ** 14).toString(),
    srcChainTokenInMaxAmount: (10 ** 14).toString(),
    srcChainAuthorityAddress: signer,
    dstChainId: CHAIN_IDS.Arbitrum,
    dstChainTokenOut: "0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f",
    dstChainTokenOutAmount: "auto",
    dstChainTokenOutRecipient: signer,
    dstChainAuthorityAddress: signer,
    prependOperatingExpenses: false
  }
}

export function getOptimismEthToSynthUSD(signer: string): Trade {
  return {
    srcChainId: CHAIN_IDS.Optimism,
    srcChainTokenIn: EVM_NATIVE_TOKEN,
    srcChainTokenInAmount: (10 ** 14).toString(),
    srcChainTokenInMinAmount: (10 ** 14).toString(),
    srcChainTokenInMaxAmount: (10 ** 14).toString(),
    srcChainAuthorityAddress: signer,
    dstChainId: CHAIN_IDS.Optimism,
    dstChainTokenOut: "0x8c6f28f2f1a3c87f0f938b96d27520d9751ec8d9",
    dstChainTokenOutAmount: "auto",
    dstChainTokenOutRecipient: signer,
    dstChainAuthorityAddress: signer,
    prependOperatingExpenses: true
  }
}

export function getArbitrumEthToBaseEth(signer: string): Trade {
  return {
    srcChainId: CHAIN_IDS.Arbitrum,
    srcChainTokenIn: EVM_NATIVE_TOKEN,
    srcChainTokenInAmount: "50000000000000",
    srcChainTokenInMinAmount: "50000000000000",
    srcChainTokenInMaxAmount: "50000000000000",
    dstChainId: CHAIN_IDS.Base,
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
    srcChainId: CHAIN_IDS.Optimism,
    srcChainTokenIn: EVM_NATIVE_TOKEN,
    srcChainTokenInAmount: "50000000000000",
    srcChainTokenInMinAmount: "50000000000000",
    srcChainTokenInMaxAmount: "50000000000000",
    dstChainId: CHAIN_IDS.Base,
    dstChainTokenOut: EVM_NATIVE_TOKEN,
    dstChainTokenOutAmount: "auto",
    srcChainAuthorityAddress: signer,
    dstChainTokenOutRecipient: signer,
    dstChainAuthorityAddress: signer,
    prependOperatingExpenses: true,
  }
}

export function getPolygonUsdcToBaseUsdc(signer: string): Trade {
  return {
    srcChainId: CHAIN_IDS.Polygon,
    srcChainTokenIn: USDC.Polygon,
    srcChainTokenInAmount: "7000000",
    srcChainTokenInMinAmount: "7000000",
    srcChainTokenInMaxAmount: "7000000",
    dstChainId: CHAIN_IDS.Base,
    dstChainTokenOut: USDC.Base,
    dstChainTokenOutAmount: "auto",
    srcChainAuthorityAddress: signer,
    dstChainTokenOutRecipient: signer,
    dstChainAuthorityAddress: signer,
    prependOperatingExpenses: true,
  }
}

export function getPolygonUsdcToArbitrumUsdc(signer: string): Trade {
  return {
    srcChainId: CHAIN_IDS.Polygon,
    srcChainTokenIn: USDC.Polygon,
    srcChainTokenInAmount: "7000000", // 4 USDC
    srcChainTokenInMinAmount: "7000000",
    srcChainTokenInMaxAmount: "7000000",
    dstChainId: CHAIN_IDS.Arbitrum,
    dstChainTokenOut: USDC.Arbitrum,
    dstChainTokenOutAmount: "auto",
    srcChainAuthorityAddress: signer,
    dstChainTokenOutRecipient: signer,
    dstChainAuthorityAddress: signer,
    prependOperatingExpenses: true,
  }
}

export function getPolygonUsdcToBaseEth(signer: string): Trade {
  return {
    srcChainId: CHAIN_IDS.Polygon,
    srcChainTokenIn: USDC.Polygon,
    srcChainTokenInAmount: "7000000",
    srcChainTokenInMinAmount: "7000000",
    srcChainTokenInMaxAmount: "7000000",
    dstChainId: CHAIN_IDS.Base,
    dstChainTokenOut: EVM_NATIVE_TOKEN,
    dstChainTokenOutAmount: "auto",
    srcChainAuthorityAddress: signer,
    dstChainTokenOutRecipient: signer,
    dstChainAuthorityAddress: signer,
    prependOperatingExpenses: true,
  }
}

export function getPolygonDaiToUSDC(signer: string): Trade {
  return {
    srcChainId: CHAIN_IDS.Polygon,
    srcChainTokenIn: DAI.Polygon,
    srcChainTokenInAmount: "2000000000000000000", // 2 DAI
    srcChainTokenInMinAmount: "2000000000000000000",
    srcChainTokenInMaxAmount: "2000000000000000000",
    dstChainId: CHAIN_IDS.Polygon,
    dstChainTokenOut: USDC.Polygon,
    dstChainTokenOutAmount: "auto",
    dstChainTokenOutRecipient: signer,
    srcChainAuthorityAddress: signer,
    dstChainAuthorityAddress: signer,
    prependOperatingExpenses: true
  };
}