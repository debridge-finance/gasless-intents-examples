import { getEnvConfig, clipHexPrefix, sortBundlesByIntentTimestampAscending } from '@utils/index';
import { privateKeyToAccount } from "viem/accounts";
import { Bundle, BundleCancelRequest, BundleStatus, CancelBundleReasonCodes, GetBundlesFilterParams } from "../types";
import { cancelBundles, getBundles } from '@utils/api';
import { getAddress } from "viem";

async function main() {

  const { privateKey } = getEnvConfig();

  const account = privateKeyToAccount(`0x${clipHexPrefix(privateKey)}`);

  const filters: GetBundlesFilterParams = {
    intentOwner: getAddress(account.address),
    intentAuthority: getAddress(account.address),
    page: 1,
    pageSize: 25
  };

  const response = await getBundles(filters);
  const bundles = response.bundles;

  console.log("\n✅ Bundle by ID fetched successfully:", JSON.stringify(response, null, 2));

  const sortedBundles = sortBundlesByIntentTimestampAscending(bundles).filter(
    (bundle) => bundle.status === BundleStatus.processing || bundle.status === BundleStatus.created);

  if (sortedBundles.length === 0) {
    console.log("\nℹ️ No processing bundles found for the specified intent owner and authority. Exiting.");
    return;
  }

  const firstBundle: Bundle = sortedBundles[0];
  const lastBundle: Bundle = sortedBundles[sortedBundles.length - 1];

  const creationTimestamp = new Date(firstBundle.intents[0].intent.intentTimestamp * 1000).toISOString();
  const expirationTimestamp = new Date(lastBundle.intents[0].intent.expirationTimestamp * 1000).toISOString();;
  const intentOwner = filters.intentOwner;

  const reasonCode = CancelBundleReasonCodes.USER_REQUEST;

  // No bundle id specified, cancelling all bundles for the intent owner
  const cancelRequest: BundleCancelRequest = {
    intentOwners: [
      intentOwner
    ],
    cancelAuthority: {
      intentOwner: intentOwner,
    },
    // creationTimestamp,
    // expirationTimestamp,
    reasonCode
  };

  const cancelRes = await cancelBundles(cancelRequest, account);

  console.log("\n✅ Bundle cancel submitted successfully:", JSON.stringify(cancelRes, null, 2));
}

main().catch((error) => {
  console.error("\n🚨 FATAL ERROR in script execution:", error);
  process.exitCode = 1;
});
