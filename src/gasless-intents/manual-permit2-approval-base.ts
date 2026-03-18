import { createWalletClient, http, parseAbi } from "viem";
import { getEnvConfig, toHexPrefixString } from "../utils";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { USDT } from "../utils/constants";

const PERMIT2_ADDRESS = "0x000000000022D473030F116dDEE9F6B43aC78BA3";

const TOKEN = USDT.Base;
const AMOUNT = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"); // Max uint256 for unlimited approval
// const AMOUNT = BigInt("0"); // 0 for removing approval

async function main() {
  const { privateKey } = getEnvConfig();

  const owner = privateKeyToAccount(toHexPrefixString(privateKey));

  const ownerWalletClient = createWalletClient({
    account: owner,
    chain: base,
    transport: http(),
  });

  const hash = await ownerWalletClient.writeContract({
    address: TOKEN as `0x${string}`,
    abi: parseAbi(["function approve(address spender, uint256 amount) returns (bool)"]),
    functionName: "approve",
    args: [PERMIT2_ADDRESS, AMOUNT],
    chain: base,
    account: owner,
  });

  console.log("Permit2 approval tx hash:", hash);
}

main().catch((error) => {
  console.error("\n🚨 FATAL ERROR in script execution:", error);
  process.exitCode = 1;
});
