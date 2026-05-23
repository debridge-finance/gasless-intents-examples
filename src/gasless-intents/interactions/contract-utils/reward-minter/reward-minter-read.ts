/**
 * Read RewardMinter state.
 *
 * Usage:
 *   npx tsx .../reward-minter-read.ts <subject>
 */
import { isAddress, type Address } from "viem";
import { loadAbi } from "../shared/artefact-loader";
import { requireDeployedAddress } from "../shared/deployed-addresses";
import { getBaseClients, readView } from "../shared/base-clients";

async function main(): Promise<void> {
  const subject = process.argv[2];
  if (!subject || !isAddress(subject)) {
    throw new Error("Usage: reward-minter-read.ts <subject>");
  }

  const address = requireDeployedAddress("RewardMinter");
  const abi = loadAbi("RewardMinter");
  const { publicClient } = getBaseClients();

  const rewards = await readView<bigint>(publicClient, {
    address,
    abi,
    functionName: "rewards",
    args: [subject as Address],
  });

  console.log(`RewardMinter: ${address}`);
  console.log(`  rewards(${subject}): ${rewards}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
