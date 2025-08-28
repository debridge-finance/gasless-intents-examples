import { bundleList } from "./api-calls";

async function main() {

  const owner = "0x55A8f5cce1d53D9Ff84EC0962882b447E5914dB8";

  const res = await bundleList(owner);

  console.log("\n✅ Bundle by ID fetched successfully:", res);
}

main().catch((error) => {
  console.error("\n🚨 FATAL ERROR in script execution:", error);
  process.exitCode = 1;
});