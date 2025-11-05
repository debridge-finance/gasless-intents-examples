import { getApi } from "../utils/api";
import { BASE_DEV_URL } from "../utils/constants";

const bundleId = "e4f157d9-9dd7-43e7-a038-86966e487cdf";

const { getBundleById } = getApi(BASE_DEV_URL);

async function main() {
  console.log("Fetching bundle by ID...", bundleId);
  const res = await getBundleById(bundleId);

  console.log("\n✅ Bundle by ID fetched successfully:", JSON.stringify(res, null, 2));
}

main().catch((error) => {
  console.error("\n🚨 FATAL ERROR in script execution:", error);
  process.exitCode = 1;
});