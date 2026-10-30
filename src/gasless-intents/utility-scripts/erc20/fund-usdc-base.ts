import {
  createWalletClient,
  createPublicClient,
  http,
  formatUnits,
  parseUnits,
  type Hex,
  type PublicClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";

import { clipHexPrefix } from "@utils/string";
import { getEnvConfig } from "@utils/env";
import { USDC } from "@utils/constants";
import { Erc20Abi } from "@utils/contract-calls/abis";
import { erc20Balance } from "@utils/contract-calls/erc20";

const USDC_BASE = USDC.Base as Hex;
const USDC_DECIMALS = 6;

async function main() {
  const recipient = process.argv[2] as Hex;
  if (!recipient || !/^0x[0-9a-fA-F]{40}$/.test(recipient)) {
    throw new Error(
      "Usage: npx tsx src/gasless-intents/utility-scripts/erc20/fund-usdc-base.ts <0xRecipient> [targetUsdc=3.2]",
    );
  }
  const target = parseUnits(process.argv[3] ?? "3.2", USDC_DECIMALS);

  const { privateKey } = getEnvConfig();
  const account = privateKeyToAccount(`0x${clipHexPrefix(privateKey)}`);
  const transport = process.env.BASE_RPC_URL ? http(process.env.BASE_RPC_URL) : http();
  const walletClient = createWalletClient({ account, chain: base, transport });
  const publicClient = createPublicClient({ chain: base, transport }) as unknown as PublicClient;

  const balance = await erc20Balance(publicClient, USDC_BASE, recipient);
  console.log(
    `${recipient} holds ${formatUnits(balance, USDC_DECIMALS)} USDC on Base (target ${formatUnits(target, USDC_DECIMALS)})`,
  );

  if (balance >= target) {
    console.log("already funded — nothing to transfer");
    return;
  }

  const deficit = target - balance;
  console.log(`transferring ${formatUnits(deficit, USDC_DECIMALS)} USDC from ${account.address}...`);
  const hash = await walletClient.writeContract({
    address: USDC_BASE,
    abi: Erc20Abi.Transfer,
    functionName: "transfer",
    args: [recipient, deficit],
  } as any);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`${hash} (${receipt.status})`);
  if (receipt.status !== "success") throw new Error("Funding transfer reverted");
}

main().catch((error) => {
  console.error("\n🚨 FATAL ERROR in script execution:", error);
  process.exitCode = 1;
});
