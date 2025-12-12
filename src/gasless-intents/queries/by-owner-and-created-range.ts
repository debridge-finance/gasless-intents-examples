import { getBundles } from "../../utils/api";
import { GetBundlesFilterParams } from "../types";

async function main() {
  const filters: GetBundlesFilterParams = {
    intentOwner: "0x55A8f5cce1d53D9Ff84EC0962882b447E5914dB8",
    createdFrom: "2025-10-01T00:00:00Z",
    createdTo: "2025-12-30T23:59:59Z",
    sort: "-createdAt",
    page: 1,
    pageSize: 25,
  };

  console.log("Fetching bundles by intentOwner and creation range...");
  const res = await getBundles(filters);

  console.log("\n✅ Bundles fetched successfully:", JSON.stringify(res, null, 2));
}

main().catch((error) => {
  console.error("\n🚨 FATAL ERROR in script execution:", error);
  process.exitCode = 1;
});