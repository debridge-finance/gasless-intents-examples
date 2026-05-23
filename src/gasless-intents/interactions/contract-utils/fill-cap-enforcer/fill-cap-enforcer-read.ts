/**
 * Read FillCapEnforcer state.
 *
 * Usage:
 *   npx tsx .../fill-cap-enforcer-read.ts                       # owner only
 *   npx tsx .../fill-cap-enforcer-read.ts <subject>             # owner + caps(subject)
 *   npx tsx .../fill-cap-enforcer-read.ts <subject> <intentId>  # owner + caps + fills(intentId)
 */
import { isAddress, isHex, type Address, type Hex } from "viem";
import { loadAbi } from "../shared/abis";
import { requireDeployedAddress } from "../shared/deployed-addresses";
import { getBaseClients, readView } from "../shared/base-clients";

async function main(): Promise<void> {
  const subject = process.argv[2];
  const intentId = process.argv[3];

  const address = requireDeployedAddress("FillCapEnforcer");
  const abi = loadAbi("FillCapEnforcer");
  const { publicClient } = getBaseClients();

  const owner = await readView<Address>(publicClient, {
    address,
    abi,
    functionName: "owner",
  });
  console.log(`FillCapEnforcer: ${address}`);
  console.log(`  owner: ${owner}`);

  if (subject) {
    if (!isAddress(subject)) throw new Error(`Invalid address: ${subject}`);
    const cap = await readView<bigint>(publicClient, {
      address,
      abi,
      functionName: "caps",
      args: [subject as Address],
    });
    console.log(`  caps(${subject}): ${cap}`);
  }

  if (intentId) {
    if (!isHex(intentId) || intentId.length !== 66) throw new Error(`Invalid intentId: ${intentId}`);
    const fills = await readView<bigint>(publicClient, {
      address,
      abi,
      functionName: "fills",
      args: [intentId as Hex],
    });
    console.log(`  fills(${intentId}): ${fills}`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
