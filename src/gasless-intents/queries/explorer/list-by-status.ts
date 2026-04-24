import { listExplorerBundles } from "@utils/api";
import { ExplorerListFilterParams } from "../../explorer.types";
import { savePayload } from "./_savePayload";

async function main() {
  const filters: ExplorerListFilterParams = {
    q: "0x55A8f5cce1d53D9Ff84EC0962882b447E5914dB8",
    status: "fulfilled,partially_fulfilled",
    limit: 25,
    page: 1,
  };

  console.log("Fetching explorer bundles filtered by status...");
  const res = await listExplorerBundles(filters);

  const path = savePayload("list-by-status", res);
  console.log(`\n✅ Saved ${res.data.length}/${res.meta.total} bundles → ${path}`);
  console.log(JSON.stringify(res, null, 2));
}

main().catch((error) => {
  console.error("\n🚨 FATAL ERROR in script execution:", error);
  process.exitCode = 1;
});
