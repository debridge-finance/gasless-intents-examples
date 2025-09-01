import { BASE_URL, BUNDLE_BY_ID } from "./consts";
import { getUrl } from "./../utils";


// const bundleId = "3a28c2fb-1c4f-4921-ad11-993663a4fad5"; // first run

// const bundleId = "6ae773f2-8ffd-4f8d-b970-f242fbd2f23c"; // second run

// const bundleId = "aaeb86d3-d5da-4fdd-b28d-0f320ceeaa37" // third run

const bundleId = "b19c2228-6bd2-4689-aecb-c44d96a2ae21" // fourth run

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