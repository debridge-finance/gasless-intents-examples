import { ethers } from "ethers";
import { getEnvConfig } from "../utils";
import { bundleList } from "./api-calls";

async function main() {

  const { privateKey } = getEnvConfig();
  const signer = new ethers.Wallet(privateKey);

  const owner = signer.address;

  const res = await bundleList(owner.toLowerCase());

  console.log("\n✅ Bundle by ID fetched successfully:", res);
}

main().catch((error) => {
  console.error("\n🚨 FATAL ERROR in script execution:", error);
  process.exitCode = 1;
});