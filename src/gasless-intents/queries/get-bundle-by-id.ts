import { getBundleById } from '@utils/api';

const bundleId = "0xa2245c8e4e25c328ce6315c9ed416dc0e6098136aa761c093cac800c3600949f"; // Replace - use your own, get after submitting a bundle

async function main() {
  console.log("Fetching bundle by ID...", bundleId);
  const res = await getBundleById(bundleId);

  console.log("\n✅ Bundle by ID fetched successfully:", JSON.stringify(res, null, 2));
}

main().catch((error) => {
  console.error("\n🚨 FATAL ERROR in script execution:", error);
  process.exitCode = 1;
});
