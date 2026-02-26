import { getBundleById } from '@utils/api';

const bundleId = "68d307f3-86d3-4247-afd7-b61c18938da8"; // Replace - use your own, get after submitting a bundle

async function main() {
  console.log("Fetching bundle by ID...", bundleId);
  const res = await getBundleById(bundleId);

  console.log("\n✅ Bundle by ID fetched successfully:", JSON.stringify(res, null, 2));
}

main().catch((error) => {
  console.error("\n🚨 FATAL ERROR in script execution:", error);
  process.exitCode = 1;
});
