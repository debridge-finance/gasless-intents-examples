import { getBundleById } from "../utils/api";

const bundleId = "c2de4116-f644-4eb6-8fb3-d1976d367a19";

async function main() {
  console.log("Fetching bundle by ID...", bundleId);
  const res = await getBundleById(bundleId);

  console.log("\n✅ Bundle by ID fetched successfully:", JSON.stringify(res, null, 2));
}

main().catch((error) => {
  console.error("\n🚨 FATAL ERROR in script execution:", error);
  process.exitCode = 1;
});