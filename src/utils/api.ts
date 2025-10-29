import { getAddress } from "viem";
import { generateCancelPreimage, getUrl, postUrl } from ".";
import {
  Bundle,
  BundleCancelRequest,
  BundleCancelResponse,
  BundleProposeBody,
  GetBundlesFilterParams,
  PaginatedResponseMetadata
} from "../gasless-intents/types";
import { BUNDLE_CANCEL_URL, BUNDLES_URL, BUNDLE_SUBMIT_URL } from "./constants";
import { privateKeyToAccount } from "viem/accounts";
import { getWalletClients } from "./wallet";

export async function createBundle(requestBody: BundleProposeBody): Promise<Bundle> {
  const response = await postUrl(BUNDLES_URL, requestBody);

  return response;
}

export async function submitBundle(requestBody) {
  const response = await postUrl(`${BUNDLE_SUBMIT_URL}?format=json`, requestBody);

  return response;
}

export async function bundleList(owner: string) {
  const response = await getUrl(`${BUNDLES_URL}?intentOwner=${owner}`);

  return response;
}

export async function getBundles(filters: GetBundlesFilterParams): Promise<PaginatedResponseMetadata & { bundles: Array<Bundle> }> {
  const usedFilters: GetBundlesFilterParams = {
    ...filters,
    page: filters.page || 1,
    pageSize: filters.pageSize || 25
  };

  const url = `${BUNDLES_URL}?${new URLSearchParams(usedFilters as any).toString()}`;
  console.log("Fetching bundles...", url);
  const res = await getUrl(url);

  return res;
}

export async function getBundleById(bundleId: string): Promise<Bundle> {
  return getUrl(`${BUNDLES_URL}/${bundleId}`);
}

export async function cancelBundles(
  cancelRequest: BundleCancelRequest,
  cancelAuthorityAccount: ReturnType<typeof privateKeyToAccount>): Promise<BundleCancelResponse> {

  const preImage = generateCancelPreimage(cancelRequest, getAddress(cancelAuthorityAccount.address)); // Make sure the address is checksummed

  // As longs as it's the same address - doesn't matter which chain client we use
  const walletClientPolygon = getWalletClients(cancelAuthorityAccount).walletClientPolygon;

  const signature = await walletClientPolygon.signMessage({ account: cancelAuthorityAccount, message: preImage });

  const requestBody = {
    ...cancelRequest,
    signature,
  }

  return postUrl(BUNDLE_CANCEL_URL, requestBody);
}
