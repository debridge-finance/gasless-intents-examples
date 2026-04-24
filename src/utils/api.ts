import { getAddress } from "viem";
import { generateCancelPreimage, getUrl, postUrl } from ".";
import {
  Bundle,
  BundleCancelRequest,
  BundleCancelResponse,
  BundleProposeBody,
  BundleProposeResponse,
  GetBundlesFilterParams,
  PaginatedResponseMetadata,
  SubmitBundleResponse,
} from "@gasless-intents/types";
import {
  ExplorerBundleDetail,
  ExplorerBundleListResponse,
  ExplorerListFilterParams,
} from "@gasless-intents/explorer.types";
import { ENDPOINTS, EXPLORER_BUNDLE_BY_ID_URL } from "./constants";
import { privateKeyToAccount } from "viem/accounts";
import { getWalletClients } from "./wallet";

const {
  BUNDLE_CANCEL_URL,
  BUNDLES_URL,
  BUNDLE_PROPOSE_URL,
  BUNDLE_SUBMIT_URL,
  EXPLORER_BUNDLES_URL,
} = ENDPOINTS;

export async function createBundle(requestBody: BundleProposeBody): Promise<BundleProposeResponse> {
  const response = await postUrl(BUNDLE_PROPOSE_URL, requestBody);

  return response as BundleProposeResponse;
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

export async function listExplorerBundles(
  filters: ExplorerListFilterParams,
): Promise<ExplorerBundleListResponse> {
  const params: Record<string, string> = {};
  for (const [k, v] of Object.entries(filters)) {
    if (v === undefined || v === null) continue;
    params[k] = String(v);
  }

  const url = `${EXPLORER_BUNDLES_URL}?${new URLSearchParams(params).toString()}`;
  console.log("Fetching explorer bundles...", url);
  return getUrl(url) as Promise<ExplorerBundleListResponse>;
}

export async function getExplorerBundleById(bundleId: string): Promise<ExplorerBundleDetail> {
  const url = EXPLORER_BUNDLE_BY_ID_URL(bundleId);
  console.log("Fetching explorer bundle detail...", url);
  return getUrl(url) as Promise<ExplorerBundleDetail>;
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
