/**
 * Transfer AllowlistGuard ownership.
 *
 * Usage:
 *   npx tsx .../allowlist-guard-transfer-ownership.ts <new-owner>
 */
import { isAddress, type Address } from "viem";
import { loadAbi } from "../shared/artefact-loader";
import { requireDeployedAddress } from "../shared/deployed-addresses";
import { getBaseClients, readView, writeTx } from "../shared/base-clients";

async function main(): Promise<void> {
  const newOwner = process.argv[2];
  if (!newOwner) {
    throw new Error("Usage: allowlist-guard-transfer-ownership.ts <new-owner>");
  }
  if (!isAddress(newOwner)) {
    throw new Error(`Invalid address: ${newOwner}`);
  }

  const address = requireDeployedAddress("AllowlistGuard");
  const abi = loadAbi("AllowlistGuard");
  const { account, publicClient, walletClient } = getBaseClients();

  console.log(`AllowlistGuard: ${address}`);
  const before = await readView<Address>(publicClient, {
    address,
    abi,
    functionName: "owner",
  });
  console.log(`  owner (before): ${before}`);

  const hash = await writeTx(walletClient, publicClient, account, {
    address,
    abi,
    functionName: "transferOwnership",
    args: [newOwner as Address],
  });
  console.log(`  Tx: ${hash} (https://basescan.org/tx/${hash})`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error(`transferOwnership reverted in tx ${hash}`);
  }
  const after = await readView<Address>(publicClient, {
    address,
    abi,
    functionName: "owner",
  });
  console.log(`  owner (after): ${after}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
