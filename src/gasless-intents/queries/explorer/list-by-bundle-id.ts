import { listExplorerBundles } from "@utils/api";
import { ExplorerListFilterParams } from "../../explorer.types";
import { savePayload } from "./_savePayload";

const BUNDLE_IDS: string[] = [
  "0x346ade92df653f0a216c3a0c9d7f2ece9299fd7282368130391e00fe0533631f",
  "0x19ce22179e8b68d0e44025269a76cd72e47d60aa0de11485a63727c9d07a4208",
  "0x14fb166242186ae8e4b88a3ee1beb5b2016cc4853b69c3fb1b8b1bd961a2f6ee",
];

async function main() {
  const filters: ExplorerListFilterParams = BUNDLE_IDS.length
    ? { bundleId: BUNDLE_IDS.join(","), limit: 25, page: 1 }
    : { q: "0x55A8f5cce1d53D9Ff84EC0962882b447E5914dB8", limit: 1, page: 1 };

  if (!BUNDLE_IDS.length) {
    console.warn(
      "BUNDLE_IDS is empty — falling back to q=<address>. " +
        "Copy a bundle ID from payloads/list-by-address.json and rerun.",
    );
  }

  console.log("Fetching explorer bundles by bundleId filter...");
  const res = await listExplorerBundles(filters);

  const path = savePayload("list-by-bundle-id", res);
  console.log(`\n✅ Saved ${res.data.length}/${res.meta.total} bundles → ${path}`);
  console.log(JSON.stringify(res, null, 2));
}

main().catch((error) => {
  console.error("\n🚨 FATAL ERROR in script execution:", error);
  process.exitCode = 1;
});
