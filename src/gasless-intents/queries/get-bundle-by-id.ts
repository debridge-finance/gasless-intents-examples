import { getBundleById } from "../../utils/api";

const bundleId = "2efa8359-df7e-4851-a7f1-b0143a4c4423"; // Replace - use your own, get after submitting a bundle

async function main() {
  console.log("Fetching bundle by ID...", bundleId);
  const res = await getBundleById(bundleId);

  console.log("\n✅ Bundle by ID fetched successfully:", JSON.stringify(res, null, 2));
}

main().catch((error) => {
  console.error("\n🚨 FATAL ERROR in script execution:", error);
  process.exitCode = 1;
});
