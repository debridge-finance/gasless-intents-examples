/**
 * Set the FillCapEnforcer cap for a subject.
 *
 * Usage:
 *   npx tsx .../fill-cap-enforcer-set-cap.ts <subject> <maxFills>
 *   (use maxFills=0 to disable enforcement)
 */
import { isAddress, type Address } from "viem";
import { loadAbi } from "../shared/abis";
import { requireDeployedAddress } from "../shared/deployed-addresses";
import { getBaseClients, readView, writeTx } from "../shared/base-clients";

async function main(): Promise<void> {
  const [subjectArg, capArg] = process.argv.slice(2);
  if (!subjectArg || !capArg) {
    throw new Error("Usage: fill-cap-enforcer-set-cap.ts <subject> <maxFills>");
  }
  if (!isAddress(subjectArg)) throw new Error(`Invalid address: ${subjectArg}`);
  const cap = BigInt(capArg);

  const address = requireDeployedAddress("FillCapEnforcer");
  const abi = loadAbi("FillCapEnforcer");
  const { account, publicClient, walletClient } = getBaseClients();

  console.log(`FillCapEnforcer: ${address}`);
  console.log(`  setCap(${subjectArg}, ${cap}) from ${account.address}`);

  const hash = await writeTx(walletClient, publicClient, account, {
    address,
    abi,
    functionName: "setCap",
    args: [subjectArg as Address, cap],
  });
  console.log(`  Tx: ${hash} (https://basescan.org/tx/${hash})`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error(`setCap reverted in tx ${hash}`);
  }
  const after = await readView<bigint>(publicClient, {
    address,
    abi,
    functionName: "caps",
    args: [subjectArg as Address],
  });
  console.log(`  Confirmed: caps(${subjectArg}) = ${after}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
