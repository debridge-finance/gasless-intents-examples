import { getEnvConfig, toHexPrefixString } from "../../utils";
import { privateKeyToAccount } from "viem/accounts";
import { BundleCancelRequest, CancelBundleReasonCodes } from "../types";
import { cancelBundles, getBundleById } from "../../utils/api";

const bundleId = "1c8b4195-7487-4015-aae3-a0e72fc0c59a"; // Change this to your desired bundle ID

async function main() {

  const { privateKey } = getEnvConfig();

  const account = privateKeyToAccount(toHexPrefixString(privateKey));

  console.log("Fetching bundle by ID...", bundleId);
  const bundle = await getBundleById(bundleId);

  console.log("\n✅ Bundle by ID fetched successfully:", JSON.stringify(bundle, null, 2));

  const intent = bundle.intents[0].intent;
  const expirationTimestamp = new Date(intent.expirationTimestamp * 1000).toISOString();
  const creationTimestamp = new Date(intent.intentTimestamp * 1000).toISOString();
  const intentOwner = intent.intentOwner;

  const reasonCode = CancelBundleReasonCodes.USER_REQUEST;

  // Because the bundle ID was specified, only this bundle will be cancelled
  const cancelRequest: BundleCancelRequest = {
    bundleId,
    intentOwners: [
      intentOwner
    ],
    cancelAuthority: {
      intentOwner: intentOwner,
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
