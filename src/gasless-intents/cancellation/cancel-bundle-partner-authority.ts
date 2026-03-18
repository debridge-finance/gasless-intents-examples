import { getEnvConfig, clipHexPrefix } from '@utils/index';
import { privateKeyToAccount } from "viem/accounts";
import { BundleCancelRequest, CancelBundleReasonCodes } from "../types";
import { cancelBundles, getBundleById } from '@utils/api';

const bundleId = "1c8b4195-7487-4015-aae3-a0e72fc0c59a"; // Change this to your desired bundle ID

async function main() {

  const { privateKey } = getEnvConfig();

  const account = privateKeyToAccount(`0x${clipHexPrefix(privateKey)}`);

  console.log("Fetching bundle by ID...", bundleId);
  const bundle = await getBundleById(bundleId);

  console.log("\n✅ Bundle by ID fetched successfully:", JSON.stringify(bundle, null, 2));

  const intent = bundle.intents[0].intent;
  const expirationTimestamp = new Date(intent.expirationTimestamp * 1000).toISOString();
  const creationTimestamp = new Date(intent.intentTimestamp * 1000).toISOString();

  if (!bundle.partnerCancelAuthority || bundle.partnerCancelAuthority.length === 0) {
    throw new Error("No partner cancel authorities found for this bundle.");
  }

  const partnerAuthority = bundle.partnerCancelAuthority[0]; // Take the first one for the example
  
  const reasonCode = CancelBundleReasonCodes.SYSTEM_ABORT;

  // No bundle id specified, cancelling all bundles for the intent owner
  const cancelRequest: BundleCancelRequest = {
    bundleId,
    cancelAuthority: {
      partnerCancelAuthority: partnerAuthority,
    },
    creationTimestamp,
    expirationTimestamp,
    reasonCode
  };

  const cancelRes = await cancelBundles(cancelRequest, account);

  console.log("\n✅ Bundle cancel submitted successfully:", JSON.stringify(cancelRes, null, 2));
}

main().catch((error) => {
  console.error("\n🚨 FATAL ERROR in script execution:", error);
  process.exitCode = 1;
});
