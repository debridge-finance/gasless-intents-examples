import { getBundles } from '@utils/api';
import { GetBundlesFilterParams } from "../types";

async function main() {
  const filters: GetBundlesFilterParams = {
    intentAuthority: "0x55A8f5cce1d53D9Ff84EC0962882b447E5914dB8",
    updatedFrom: "2025-11-01T00:00:00Z",
    updatedTo: "2025-12-10T23:59:59Z",
    sort: "-updatedAt",
    page: 1,
    pageSize: 50,
  };

  console.log("Fetching bundles by intentAuthority and updated range...");
  const res = await getBundles(filters);

  console.log("\n✅ Bundles fetched successfully (by authority + updatedFrom/updatedTo):", JSON.stringify(res, null, 2));
}

main().catch((error) => {
  console.error("\n🚨 FATAL ERROR in script execution:", error);
  process.exitCode = 1;
});