import { BASE_URL, BUNDLE_BY_ID } from "./consts";
import { getUrl } from "./../utils";


const bundleId = "3a28c2fb-1c4f-4921-ad11-993663a4fad5"; // First try

const url = `${BASE_URL}${BUNDLE_BY_ID}${bundleId}`

async function main() {
  console.log("Fetching bundle by ID...", url);
  const res = await getUrl(url);

  console.log("\n✅ Bundle by ID fetched successfully:", JSON.stringify(res, null, 2));
}

main().catch((error) => {
  console.error("\n🚨 FATAL ERROR in script execution:", error);
  process.exitCode = 1;
});