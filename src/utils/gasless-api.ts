import { getAddress } from "viem";
import { generateCancelPreimage } from "@utils/index";
import {
  Bundle,
  BundleCancelRequest,
  BundleCancelResponse,
  BundleProposeBody,
  GetBundlesFilterParams,
  PaginatedResponseMetadata,
  SubmitBundleResponse,
} from "@gasless-intents/types";
import { ENDPOINTS, SOLANA_TRANSACTION_REFRESH_URL } from "./constants";
import { privateKeyToAccount } from "viem/accounts";
import { getWalletClients } from "./wallet";
import { postUrl, getUrl, getPublicJsonHeaders } from "./http";
import { getHeaders } from "./env";

const { BUNDLE_CANCEL_URL, BUNDLES_URL, BUNDLE_PROPOSE_URL, BUNDLE_SUBMIT_URL } = ENDPOINTS;

export type BundleApiEndpoints = {
  BUNDLE_PROPOSE_URL: string;
  BUNDLE_SUBMIT_URL: string;
  requiresPartnerApiKey?: boolean;
};

const DEFAULT_BUNDLE_ENDPOINTS: BundleApiEndpoints = {
  BUNDLE_PROPOSE_URL,
  BUNDLE_SUBMIT_URL,
  requiresPartnerApiKey: false,
};

export async function createBundle(
  requestBody: BundleProposeBody,
  endpoints: BundleApiEndpoints = DEFAULT_BUNDLE_ENDPOINTS,
): Promise<Bundle> {
  const headers = endpoints.requiresPartnerApiKey === false ? getPublicJsonHeaders() : getHeaders();
  const response = await postUrl(endpoints.BUNDLE_PROPOSE_URL, requestBody, headers);

  return response as Bundle;
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
export async function submitBundle(
  requestBody: Bundle,
  endpoints: BundleApiEndpoints = DEFAULT_BUNDLE_ENDPOINTS,
): Promise<SubmitBundleResponse> {
  const headers = endpoints.requiresPartnerApiKey === false ? getPublicJsonHeaders() : getHeaders();
  const suffix = endpoints.requiresPartnerApiKey === false ? "" : "?format=json";
  const response = await postUrl(`${endpoints.BUNDLE_SUBMIT_URL}${suffix}`, requestBody, headers);

  return response as SubmitBundleResponse;
}

export async function refreshSolanaTransaction(serializedTransaction: string): Promise<string> {
  const response = await postUrl(
    SOLANA_TRANSACTION_REFRESH_URL,
    { transaction: serializedTransaction },
    getPublicJsonHeaders(),
  ) as { transaction?: string; errorMessage?: string };

  if (!response.transaction) {
    throw new Error(
      `Solana transaction refresh returned no transaction: ${response.errorMessage ?? "unknown error"}`,
    );
  }
  return response.transaction;
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

export type BundleCancelApiEndpoints = {
  BUNDLE_CANCEL_URL: string;
  requiresPartnerApiKey?: boolean;
};

export async function cancelBundleById(
  cancelRequest: BundleCancelRequest & {
    bundleId: string;
    creationTimestamp: string;
    expirationTimestamp: string;
  },
  cancelAuthorityAccount: ReturnType<typeof privateKeyToAccount>,
  endpoints: BundleCancelApiEndpoints,
): Promise<BundleCancelResponse> {
  const authority = getAddress(cancelAuthorityAccount.address);
  const preImage = generateCancelPreimage(cancelRequest, authority);
  const signature = await cancelAuthorityAccount.signMessage({ message: preImage });
  const headers = endpoints.requiresPartnerApiKey === false ? getPublicJsonHeaders() : getHeaders();

  return postUrl(
    endpoints.BUNDLE_CANCEL_URL,
    { ...cancelRequest, signature },
    headers,
  ) as Promise<BundleCancelResponse>;
}
