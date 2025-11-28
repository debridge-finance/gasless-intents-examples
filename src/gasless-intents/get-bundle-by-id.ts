import { getBundleById } from "../utils/api";

const bundleId = "235901e4-311e-417f-ab1a-a543576a105c"; // Replace - use your own, get after submitting a bundle

async function main() {
  console.log("Fetching bundle by ID...", bundleId);
  const res = await getBundleById(bundleId);

  console.log("\n✅ Bundle by ID fetched successfully:", JSON.stringify(res, null, 2));
}

main().catch((error) => {
  console.error("\n🚨 FATAL ERROR in script execution:", error);
  process.exitCode = 1;
});
