import { getBundles } from "../../utils/api";
import { GetBundlesFilterParams } from "../types";

async function main() {
  const filters: GetBundlesFilterParams = {
    intentOwner: "0x55A8f5cce1d53D9Ff84EC0962882b447E5914dB8",
    page: 1,
    pageSize: 25,
  };

  console.log("Fetching bundles by intentOwner...");
  const res = await getBundles(filters);

  console.log("\n✅ Bundles fetched successfully (by intentOwner):", JSON.stringify(res, null, 2));
}

main().catch((error) => {
  console.error("\n🚨 FATAL ERROR in script execution:", error);
  process.exitCode = 1;
});