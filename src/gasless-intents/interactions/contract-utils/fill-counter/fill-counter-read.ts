/**
 * Read FillCounter state.
 *
 * Usage:
 *   npx tsx .../fill-counter-read.ts <subject> [token]
 */
import { isAddress, type Address } from "viem";
import { loadAbi } from "../shared/artefact-loader";
import { requireDeployedAddress } from "../shared/deployed-addresses";
import { getBaseClients, readView } from "../shared/base-clients";

async function main(): Promise<void> {
  const subject = process.argv[2];
  const token = process.argv[3];
  if (!subject || !isAddress(subject)) {
    throw new Error("Usage: fill-counter-read.ts <subject> [token]");
  }
  if (token && !isAddress(token)) {
    throw new Error(`Invalid token address: ${token}`);
  }

  const address = requireDeployedAddress("FillCounter");
  const abi = loadAbi("FillCounter");
  const { publicClient } = getBaseClients();

  const [stats, perToken] = await Promise.all([
    readView<readonly [bigint, bigint]>(publicClient, {
      address,
      abi,
      functionName: "getStats",
      args: [subject as Address],
    }),
    token
      ? readView<bigint>(publicClient, {
          address,
          abi,
          functionName: "lifetimeGiveAmountByToken",
          args: [subject as Address, token as Address],
        })
      : Promise.resolve<bigint | null>(null),
  ]);

  const [fills, giveTotal] = stats;
  console.log(`FillCounter: ${address}`);
  console.log(`  subject: ${subject}`);
  console.log(`  lifetimeFills: ${fills}`);
  console.log(`  lifetimeGiveAmount: ${giveTotal}`);
  if (token) {
    console.log(`  lifetimeGiveAmountByToken[${token}]: ${perToken}`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
