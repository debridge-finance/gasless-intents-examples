import { getAddress } from "viem";
import { generateCancelPreimage } from "@utils/index";
import {
  Bundle,
  BundleCancelRequest,
  BundleCancelResponse,
  BundleProposeBody,
  BundleQuoteBody,
  BundleQuoteResponse,
  ExplorerBundleDetail,
  GetBundlesFilterParams,
  PaginatedResponseMetadata,
  SubmitBundleResponse,
} from "@gasless-intents/types";
import { ENDPOINTS } from "./constants";
import { privateKeyToAccount } from "viem/accounts";
import { getWalletClients } from "./wallet";
import { postUrl, getUrl } from "./http";

const { BUNDLE_CANCEL_URL, BUNDLES_URL, BUNDLE_PROPOSE_URL, BUNDLE_SUBMIT_URL } = ENDPOINTS;

/** Propose a bundle; omit wallet addresses for a quote and re-propose after connection. */
export function createBundle(requestBody: BundleProposeBody): Promise<Bundle>;
export function createBundle(requestBody: BundleQuoteBody): Promise<BundleQuoteResponse>;
export async function createBundle(requestBody: BundleProposeBody | BundleQuoteBody): Promise<Bundle | BundleQuoteResponse> {
  const response = await postUrl(BUNDLE_PROPOSE_URL, requestBody);

  return response as Bundle | BundleQuoteResponse;
}

/**
 * Ask deBridge to refresh and service-sign a hex-encoded Solana transaction.
 * The input must retain the API's original signature. The wallet must sign the returned
 * transaction again: changing a blockhash invalidates signatures over the old message.
 * Docs: /api-reference/gasless-api/refresh-blockhash-and-resign-a-solana-transaction
 */
export async function refreshSolanaTransaction(transaction: string): Promise<string> {
  const response = await postUrl(ENDPOINTS.BUNDLE_REFRESH_SOLANA_TX_URL, { transaction }) as { transaction?: unknown };
  if (typeof response.transaction !== "string" || !/^0x(?:[0-9a-fA-F]{2})+$/.test(response.transaction)) {
    throw new Error("refresh-solana-tx returned an invalid hex-encoded transaction");
  }
  return response.transaction;
}

/**
 * Submits the bundle to the API, creating it if it doesn't exist, or using the existing one if the same `requestId` is provided. Returns a bundleId.
 *
 * A bundleId is deterministically computed as a hash of `(requestId + referralCode + intentIds)`.
 *
 * intentId is computed deterministically from the intent constraints and the user's address.
 *
 * Idempotency is enforced on the /submit endpoint using the `requestId` field.
 * @param requestBody
 * @returns A unique bundleId.
 */
export async function submitBundle(requestBody: Bundle): Promise<SubmitBundleResponse> {
  if ("isQA" in requestBody) {
    throw new Error("Use isQa (lowercase a) on submit. isQA is the backend's internal name and does not enable REST QA mode.");
  }
  const response = await postUrl(`${BUNDLE_SUBMIT_URL}?format=json`, requestBody);

  return response as SubmitBundleResponse;
}

export async function getBundles(
  filters: GetBundlesFilterParams,
): Promise<PaginatedResponseMetadata & { bundles: Array<Bundle> }> {
  const usedFilters: GetBundlesFilterParams = {
    ...filters,
    page: filters.page || 1,
    pageSize: filters.pageSize || 25,
  };

  const url = `${BUNDLES_URL}?${new URLSearchParams(usedFilters as any).toString()}`;
  console.log("Fetching bundles...", url);
  const res = await getUrl(url);

  return res as PaginatedResponseMetadata & { bundles: Array<Bundle> };
}

export async function getBundleById(bundleId: string): Promise<Bundle> {
  return getUrl(`${BUNDLES_URL}/${bundleId}`) as Promise<Bundle>;
}

/**
 * Fetch full Explorer details, including the QA simulation result when available.
 * Hidden bundles can be fetched by ID. showHiddenBundles=true is only needed
 * when listing bundles with GET /v1/explorer/bundles.
 */
export async function getExplorerBundleById(bundleId: string): Promise<ExplorerBundleDetail> {
  return getUrl(`${ENDPOINTS.EXPLORER_BUNDLES_URL}/${encodeURIComponent(bundleId)}`) as Promise<ExplorerBundleDetail>;
}

export async function cancelBundles(
  cancelRequest: BundleCancelRequest,
  cancelAuthorityAccount: ReturnType<typeof privateKeyToAccount>,
): Promise<BundleCancelResponse> {
  if (!cancelRequest.creationTimestamp) {
    cancelRequest.creationTimestamp = (new Date(2025, 5).getTime() / 1000).toString(); // long past time
  }

  if (!cancelRequest.expirationTimestamp) {
    cancelRequest.expirationTimestamp = (new Date(2030, 0).getTime() / 1000).toString(); // default expiration timestamp to a far future date if not provided
  }

  const preImage = generateCancelPreimage(cancelRequest, getAddress(cancelAuthorityAccount.address)); // Make sure the address is checksummed

  // As longs as it's the same address - doesn't matter which chain client we use
  const walletClientPolygon = getWalletClients(cancelAuthorityAccount).walletClientPolygon;

  const signature = await walletClientPolygon.signMessage({ account: cancelAuthorityAccount, message: preImage });

  const requestBody = {
    ...cancelRequest,
    signature,
    referralCode: 110000002,
  };

  return postUrl(BUNDLE_CANCEL_URL, requestBody) as Promise<BundleCancelResponse>;
}
