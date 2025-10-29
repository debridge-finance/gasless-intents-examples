// API

// export const BASE_URL = "https://cross-chain-api-intent.dev.debridge.io/v1.0"
// export const BASE_URL = "https://cross-chain-api-intent-hanoi.dev.debridge.io/v1.0"
export const BASE_URL = "https://api.debridge.io/v1/gasless"
export const BASE_DEV_URL = "https://dev-api.debridge.io/v1/gasless"

export const BUNDLES = "/bundles"

export const BUNDLES_URL = `${BASE_URL}${BUNDLES}`
export const BUNDLES_DEV_URL = `${BASE_DEV_URL}${BUNDLES}`

export const BUNDLE_SUBMIT_URL = `${BUNDLES_URL}/submit`
export const BUNDLE_LIST_URL = `${BUNDLES_URL}/list`
export const BUNDLE_CANCEL_URL = `${BUNDLES_URL}/cancel`;

export const BUNDLE_DEV_SUBMIT_URL = `${BUNDLES_DEV_URL}/submit`
export const BUNDLE_DEV_LIST_URL = `${BUNDLES_DEV_URL}/list`
export const BUNDLE_DEV_CANCEL_URL = `${BUNDLES_DEV_URL}/cancel`;

// Tokens

// Type definitions
export const SOL_NATIVE = "11111111111111111111111111111111"
export const EVM_NATIVE_TOKEN = "0x0000000000000000000000000000000000000000";

export const USDC = {
  Polygon: "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359",
  BNB: "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d",
  Base: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
  Solana: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
}

export const USDT = {
  Polygon: "0xc2132d05d31c914a87c6611c10748aeb04b58e8f",
  BNB: "0x55d398326f99059ff775485246999027b3197955",
  Solana: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"
}

export const LINK = {
  Polygon: "0x53e0bca35ec356bd5dddfebbd1fc0fd03fabad39",
}

export const WBNB = {
  BNB: "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c",
}

export const WETH = {
  Polygon: "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619",
}

// Used as a placeholder value for the amount - 256 bits, 8 repetitions of "deadbeef"
export const PLACEHOLDER_TOKEN_AMOUNT = "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef";

export const LINGO = {
  Base: "0xfb42Da273158B0F642F59F2Ba7cc1d5457481677"
}

// SOL
export const SOL_JUP = "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN"