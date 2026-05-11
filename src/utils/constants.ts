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

export const CASH = {
  Solana: "CASHx9KJUStyftLFWGvEVf59SGeG9sh5FfcnZMVPCASH",
};

// Pools

export const AAVE_V3_POOL_ARBITRUM = "0x794a61358D6845594F94dc1DB02A252b5b4814aD";
