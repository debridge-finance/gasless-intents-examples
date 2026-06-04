/**
 * Toggle a single address on the AllowlistGuard allowlist.
 *
 * Usage:
 *   npx tsx .../allowlist-guard-set-allowed.ts <subject> <true|false>
 */
import { isAddress, type Address } from "viem";
import { loadAbi } from "../shared/abis";
import { requireDeployedAddress } from "../shared/deployed-addresses";
import { getBaseClients, readView, writeTx } from "../shared/base-clients";

async function main(): Promise<void> {
  const [subjectArg, boolArg] = process.argv.slice(2);
  if (!subjectArg || !boolArg) {
    throw new Error("Usage: allowlist-guard-set-allowed.ts <subject> <true|false>");
  }
  if (!isAddress(subjectArg)) {
    throw new Error(`Invalid address: ${subjectArg}`);
  }
  if (boolArg !== "true" && boolArg !== "false") {
    throw new Error(`Expected true|false, got ${boolArg}`);
  }
  const isAllowed = boolArg === "true";

  const address = requireDeployedAddress("AllowlistGuard");
  const abi = loadAbi("AllowlistGuard");
  const { account, publicClient, walletClient } = getBaseClients();

  console.log(`AllowlistGuard: ${address}`);
  console.log(`  setAllowed(${subjectArg}, ${isAllowed}) from ${account.address}`);

  const hash = await writeTx(walletClient, publicClient, account, {
    address,
    abi,
    functionName: "setAllowed",
    args: [subjectArg as Address, isAllowed],
  });
  console.log(`  Tx: ${hash} (https://basescan.org/tx/${hash})`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error(`setAllowed reverted in tx ${hash}`);
  }
  const after = await readView<boolean>(publicClient, {
    address,
    abi,
    functionName: "allowed",
    args: [subjectArg as Address],
  });
  console.log(`  Confirmed: allowed(${subjectArg}) = ${after}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
