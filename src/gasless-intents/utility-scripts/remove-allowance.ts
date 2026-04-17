import { createWalletClient, http, parseAbi } from "viem";
import { getEnvConfig, toHexPrefixString } from "../utils";
import { arbitrum } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { DAI } from "../utils/constants";

const ALLOWANCE_HOLDER_CONTRACT = "0xddddddddd4B6472c5002F95610b194D1161223d0";

const TOKEN = DAI.Arbitrum;
const AMOUNT = BigInt("0"); // 0 to remove approval

async function main() {
  const { privateKey } = getEnvConfig();

  const owner = privateKeyToAccount(toHexPrefixString(privateKey));

  const ownerWalletClient = createWalletClient({
    account: owner,
    chain: arbitrum,
    transport: http(),
  });

  const hash = await ownerWalletClient.writeContract({
    address: TOKEN as `0x${string}`,
    abi: parseAbi(["function approve(address spender, uint256 amount) returns (bool)"]),
    functionName: "approve",
    args: [ALLOWANCE_HOLDER_CONTRACT, AMOUNT],
    chain: arbitrum,
    account: owner,
  });

  console.log("Allowance removal tx hash:", hash);
}

main().catch((error) => {
  console.error("\n🚨 FATAL ERROR in script execution:", error);
  process.exitCode = 1;
});