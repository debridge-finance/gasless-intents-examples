/**
 * Read LoggingInteractionHook counters for an intentId.
 *
 * Usage:
 *   npx tsx .../logging-hook-read.ts <intentId>
 */
import { isHex, type Hex } from "viem";
import { loadAbi } from "../shared/abis";
import { requireDeployedAddress } from "../../shared/deployed-addresses";
import { getBaseClients, readView } from "../shared/base-clients";

async function main(): Promise<void> {
  const intentId = process.argv[2];
  if (!intentId || !isHex(intentId) || intentId.length !== 66) {
    throw new Error("Usage: logging-hook-read.ts <intentId (0x-prefixed bytes32)>");
  }

  const address = requireDeployedAddress("LoggingInteractionHook");
  const abi = loadAbi("LoggingInteractionHook");
  const { publicClient } = getBaseClients();

  const [fillCount, cumulativeGiveAmount] = await Promise.all([
    readView<bigint>(publicClient, {
      address,
      abi,
      functionName: "fillCount",
      args: [intentId as Hex],
    }),
    readView<bigint>(publicClient, {
      address,
      abi,
      functionName: "cumulativeGiveAmount",
      args: [intentId as Hex],
    }),
  ]);

  console.log(`LoggingInteractionHook: ${address}`);
  console.log(`  intentId: ${intentId}`);
  console.log(`  fillCount: ${fillCount}`);
  console.log(`  cumulativeGiveAmount: ${cumulativeGiveAmount}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
