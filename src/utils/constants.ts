import "dotenv/config";

export const BASE_URL = "https://api-gaslessb2b.debridge.finance";

export const V1_BASE = "/v1/gasless";
export const V1_1_BASE = "/v1.1/gasless";

export const BUNDLES = "/bundles";

export const SOLANA_RPC_URL = "https://api.mainnet-beta.solana.com";

export const ENDPOINTS = {
  BUNDLES_URL: `${BASE_URL}${V1_BASE}${BUNDLES}`,
  BUNDLE_PROPOSE_URL: `${BASE_URL}${V1_1_BASE}${BUNDLES}`,
  BUNDLE_SUBMIT_URL: `${BASE_URL}${V1_1_BASE}${BUNDLES}/submit`,
  BUNDLE_CANCEL_URL: `${BASE_URL}${V1_BASE}${BUNDLES}/cancel`,
};

export function getHyperliquidApiBaseUrl(): string {
  const value = process.env.HYPERLIQUID_API_BASE_URL?.trim().replace(/\/+$/, "");
  if (!value) throw new Error("HYPERLIQUID_API_BASE_URL not found in .env file.");
  return value;
}

export const HYPERLIQUID_ENDPOINTS = {
  get BUNDLE_PROPOSE_URL() {
    return `${getHyperliquidApiBaseUrl()}/api/bundles`;
  },
  get BUNDLE_SUBMIT_URL() {
    return `${getHyperliquidApiBaseUrl()}/api/bundles/submit`;
  },
  get BUNDLE_CANCEL_URL() {
    return `${getHyperliquidApiBaseUrl()}/api/bundles/cancel`;
  },
  requiresPartnerApiKey: true,
};

// Price API (no /gasless prefix)
export const PRICE_RATES_URL = `${BASE_URL}/v1/token/price`;
export const PRICE_CHART_URL = `${BASE_URL}/v1/token/chart`;

// Tokens

export const SOL_NATIVE = "11111111111111111111111111111111";
export const WSOL = "So11111111111111111111111111111111111111112";
export const EVM_NATIVE_TOKEN = "0x0000000000000000000000000000000000000000";
export const SOL_JUP = "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN"; // 6 decimals https://solscan.io/token/JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN
export const DBR_SOL = "DBRiDgJAMsM95moTzJs7M9LnkGErpbv9v6CUR1DXnUu5";

export const USDC = {
  Ethereum: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  Polygon: "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359",
  BNB: "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d",
  Base: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
  Arbitrum: "0xaf88d065e77c8cc2239327c5edb3a432268e5831",
  Optimism: "0x0b2c639c533813f4aa9d7837caf62653d097ff85",
  Solana: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
};

export const HYPERCORE = {
  USDC: {
    symbol: "USDC",
    address: "0xb88339CB7199b77E23DB6E890353E22632Ba630f",
    tokenId: "0x6d1e7cde53ba9467b783cb7c530ce054",
    index: 0,
    coreDecimals: 8,
    evmDecimals: 6,
    systemAddress: "0x2000000000000000000000000000000000000000",
    withdrawFeePolicy: "self-paid" as string | null,
  },
  HYPE: {
    symbol: "HYPE",
    address: "0x5555555555555555555555555555555555555555",
    tokenId: "0x0d01dc56dcaaca66ad901c959b4011ec",
    index: 150,
    coreDecimals: 8,
    evmDecimals: 18,
    systemAddress: "0x2222222222222222222222222222222222222222",
    withdrawFeePolicy: "none" as string | null,
  },
  PURR: {
    symbol: "PURR",
    address: "0x9b498c3c8a0b8cd8ba1d9851d40d186f1872b44e",
    tokenId: "0xc1fb593aeffbeb02f85e0308e9956a90",
    index: 1,
    coreDecimals: 5,
    evmDecimals: 18,
    systemAddress: "0x2000000000000000000000000000000000000001",
    withdrawFeePolicy: null as string | null,
  },
  USDT0: {
    symbol: "USDT0",
    address: "0xb8ce59fc3717ada4c02eadf9682a9e934f625ebb",
    tokenId: "0x25faedc3f054130dbb4e4203aca63567",
    index: 268,
    coreDecimals: 8,
    evmDecimals: 6,
    systemAddress: "0x200000000000000000000000000000000000010c",
    withdrawFeePolicy: "self-paid" as string | null,
  },
};

export type HyperCoreToken = (typeof HYPERCORE)[keyof typeof HYPERCORE];

export const HYPERCORE_PERPS_USDC_ADDRESS = "0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC";

export const HYPEREVM = {
  chainId: 999,
  dlnChainId: 100000022,
  rpcUrl: "https://rpc.hyperliquid.xyz/evm",
  spotSendExecutor: "0xb7Be1af750755Dab829E1E94122d8ABB27fc52f5",
  usdcDepositWallet: "0x6B9E773128f453f5c2C60935Ee2DE2CBc5390A24",
  whype: "0x5555555555555555555555555555555555555555",
};

export const HYPERCORE_CHAIN_ID = 200000001;

export const HYPERLIQUID_ESCROW_FACTORY = "0xAd635f04134562D58B30C93676FBBdF37f5c6dAB";

export const SOLANA_TRANSACTION_REFRESH_URL =
  "https://deswap.debridge.finance/v1.0/bundle/refresh-solana-tx";

export const USDT = {
  Ethereum: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  Polygon: "0xc2132d05d31c914a87c6611c10748aeb04b58e8f",
  BNB: "0x55d398326f99059ff775485246999027b3197955",
  Solana: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
  Arbitrum: "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9",
  Base: "0xfde4c96c8593536e31f229ea8f37b2ada2699bb2",
};

export const LINK = {
  Polygon: "0x53e0bca35ec356bd5dddfebbd1fc0fd03fabad39",
};

export const WBNB = {
  BNB: "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c",
};

export const WETH = {
  Ethereum: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  Polygon: "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619",
  Arbitrum: "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
};

export const WBTC = {
  Ethereum: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
}

export const DAI = {
  Polygon: "0x8f3cf7ad23cd3cadbd9735aff958023239c6a063",
  Arbitrum: "0xda10009cbd5d07dd0cecc66161fc93d7c9000da1",
  Ethereum: "0x6b175474e89094c44da98b954eedeac495271d0f",
};

export const POLYTRADE = {
  Polygon: "0x692ac1e363ae34b6b489148152b12e2785a3d8d6",
};

// Used as a placeholder value for the amount - 256 bits, 8 repetitions of "deadbeef"
export const PLACEHOLDER_TOKEN_AMOUNT = "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef";

export const LINGO = {
  Base: "0xfb42Da273158B0F642F59F2Ba7cc1d5457481677",
};

export const DE_BRIDGE_CONTRACTS = {
  EVM: {
    AllowanceHolder: "0xddddddddd4B6472c5002F95610b194D1161223d0",
    IntentManager: "0xDDDDDDDdeB2E68Ee19832e356FCB5537124A9708",
  },
};

export const ECHO_BASE = "0xa77563ce5dfb7fe631d4b9fba8968efbb1f722c8";
export const ECHO_WITH_SIG_BASE = "0x30f1acea1948fa286f6ebd948d79fadeb2ae1ca9";

export const CASH = {
  Solana: "CASHx9KJUStyftLFWGvEVf59SGeG9sh5FfcnZMVPCASH",
};

// Pools

export const AAVE_V3_POOL_ARBITRUM = "0x794a61358D6845594F94dc1DB02A252b5b4814aD";
