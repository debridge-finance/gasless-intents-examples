/**
 * Read AllowlistGuard state on Base.
 *
 * Usage:
 *   npx tsx .../allowlist-guard-read.ts             # prints owner only
 *   npx tsx .../allowlist-guard-read.ts <subject>   # prints owner + allowed(subject)
 */
import { isAddress, type Address } from "viem";
import { loadAbi } from "../shared/abis";
import { requireDeployedAddress } from "../shared/deployed-addresses";
import { getBaseClients, readView } from "../shared/base-clients";

async function main(): Promise<void> {
  const address = requireDeployedAddress("AllowlistGuard");
  const abi = loadAbi("AllowlistGuard");
  const { publicClient } = getBaseClients();

  const owner = await readView<Address>(publicClient, {
    address,
    abi,
    functionName: "owner",
  });
  console.log(`AllowlistGuard: ${address}`);
  console.log(`  owner: ${owner}`);

  const subject = process.argv[2];
  if (subject) {
    if (!isAddress(subject)) {
      throw new Error(`Invalid address: ${subject}`);
    }
    const allowed = await readView<boolean>(publicClient, {
      address,
      abi,
      functionName: "allowed",
      args: [subject as Address],
    });
    console.log(`  allowed(${subject}): ${allowed}`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
