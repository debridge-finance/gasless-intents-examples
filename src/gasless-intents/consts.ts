// export const BASE_URL = "https://cross-chain-api-intent.dev.debridge.io/v1.0"
// export const BASE_URL = "https://cross-chain-api-intent-hanoi.dev.debridge.io/v1.0"
export const BASE_URL = "https://api.debridge.io/v1/gasless";

export const ENDPOINTS = {
  BUNDLES: "/bundles",
  BUNDLE_BY_ID: (id: string) => `/bundles/${id}`,
  SUBMIT_BUNDLE: "/bundles/submit",
};

