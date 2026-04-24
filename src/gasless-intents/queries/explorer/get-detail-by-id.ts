import { getExplorerBundleById, listExplorerBundles } from "@utils/api";
import { savePayload } from "./_savePayload";

const BUNDLE_ID = "0x346ade92df653f0a216c3a0c9d7f2ece9299fd7282368130391e00fe0533631f";

async function main() {
  console.log(`Fetching explorer bundle detail for id=${BUNDLE_ID}...`);
  const res = await getExplorerBundleById(BUNDLE_ID);

  const path = savePayload("get-detail-by-id", res);
  console.log(`\n✅ Saved bundle detail → ${path}`);
  console.log(JSON.stringify(res, null, 2));
}

main().catch((error) => {
  console.error("\n🚨 FATAL ERROR in script execution:", error);
  process.exitCode = 1;
});
