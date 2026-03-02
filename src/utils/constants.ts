export const BASE_URL = "https://api-gaslessb2b.debridge.finance";

// export const BASE_URL = "https://api-dev.debridge.io"; // 0x219c915f73b86f625f1668a436b2f9712465a2625452396b9f1a195dc4f70cb7

export const V1_BASE = "/v1/gasless";
export const V1_1_BASE = "/v1.1/gasless";

export const BUNDLES = "/bundles";

export const BUNDLES_URL = `${BASE_URL}${V1_BASE}${BUNDLES}`;

export const SOLANA_RPC_URL = "https://api.mainnet-beta.solana.com";

export function getEndpoints(baseUrl: string) {
  const BUNDLES_URL = `${baseUrl}${V1_BASE}${BUNDLES}`;
  const BUNDLE_PROPOSE_URL = `${baseUrl}${V1_1_BASE}${BUNDLES}`;
  const BUNDLE_SUBMIT_URL = `${baseUrl}${V1_1_BASE}${BUNDLES}/submit`;
  const BUNDLE_CANCEL_URL = `${baseUrl}${V1_BASE}${BUNDLES}/cancel`;

  return {
    BUNDLES_URL,
    BUNDLE_PROPOSE_URL,
    BUNDLE_SUBMIT_URL,
    BUNDLE_CANCEL_URL,
  };
}

// Tokens

export const SOL_NATIVE = "11111111111111111111111111111111";
export const EVM_NATIVE_TOKEN = "0x0000000000000000000000000000000000000000";
export const SOL_JUP = "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN"; // 6 decimals https://solscan.io/token/JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN
export const DBR_SOL = "DBRiDgJAMsM95moTzJs7M9LnkGErpbv9v6CUR1DXnUu5";

export const USDC = {
  Polygon: "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359",
  BNB: "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d",
  Base: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
  Arbitrum: "0xaf88d065e77c8cc2239327c5edb3a432268e5831",
  Optimism: "0x0b2c639c533813f4aa9d7837caf62653d097ff85",
  Solana: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
};

export const USDT = {
  Polygon: "0xc2132d05d31c914a87c6611c10748aeb04b58e8f",
  BNB: "0x55d398326f99059ff775485246999027b3197955",
  Solana: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
};

export const LINK = {
  Polygon: "0x53e0bca35ec356bd5dddfebbd1fc0fd03fabad39",
};

export const WBNB = {
  BNB: "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c",
};

export const WETH = {
  Polygon: "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619",
  Arbitrum: "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
};

export const DAI = {
  Polygon: "0x8f3cf7ad23cd3cadbd9735aff958023239c6a063",
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
