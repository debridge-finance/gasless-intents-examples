/**
 * One-shot AllowlistGuard seed script. Hardcoded inputs — edit the
 * SUBJECTS_TO_ALLOW constant below and re-run. No CLI args.
 *
 * Runs as the owner (whoever holds SIGNER_PK in .env, which must equal
 * AllowlistGuard.owner()). Calls `setManyAllowed(SUBJECTS_TO_ALLOW, true)`,
 * then prints the post-write `allowed(x)` state for each subject.
 *
 * Why a hardcoded script: the rest of the contract-utils take positional
 * CLI args; this one is a "just run it" version that bakes in the address
 * you want to operate on. Adjust the constant below and re-run for a
 * different subject — no quoting / argv parsing in the middle.
 */
import { isAddress, type Address } from "viem";
import { loadAbi } from "../shared/artefact-loader";
import { requireDeployedAddress } from "../shared/deployed-addresses";
import { getBaseClients, readView, writeTx } from "../shared/base-clients";

// ─── Edit me ───────────────────────────────────────────────────────────────
const SUBJECTS_TO_ALLOW: Address[] = [
  "0x55a8f5cce1d53d9ff84ec0962882b447e5914db8",
];
const SET_TO: boolean = true;
// ────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  for (const addr of SUBJECTS_TO_ALLOW) {
    if (!isAddress(addr)) throw new Error(`Bad address in SUBJECTS_TO_ALLOW: ${addr}`);
  }

  const address = requireDeployedAddress("AllowlistGuard");
  const abi = loadAbi("AllowlistGuard");
  const { account, publicClient, walletClient } = getBaseClients();

  const owner = await readView<Address>(publicClient, {
    address,
    abi,
    functionName: "owner",
  });
  if (owner.toLowerCase() !== account.address.toLowerCase()) {
    throw new Error(
      `Owner mismatch — guard.owner()=${owner}, but SIGNER_PK is ${account.address}. ` +
        `Use the deployer's key or transferOwnership first.`,
    );
  }

  console.log(`AllowlistGuard: ${address}`);
  console.log(`Owner / caller: ${account.address}`);
  console.log(`Setting ${SUBJECTS_TO_ALLOW.length} subject(s) → allowed=${SET_TO}`);
  for (const subject of SUBJECTS_TO_ALLOW) {
    console.log(`  ${subject}`);
  }

  const hash = await writeTx(walletClient, publicClient, account, {
    address,
    abi,
    functionName: "setManyAllowed",
    args: [SUBJECTS_TO_ALLOW, SET_TO],
  });
  console.log(`\nTx: ${hash} (https://basescan.org/tx/${hash})`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error(`setManyAllowed reverted in tx ${hash}`);
  }
  console.log(`Confirmed in block ${receipt.blockNumber}; ${receipt.logs.length} AllowedUpdated events`);

  console.log("\nPost-write allowed(subject) state:");
  for (const subject of SUBJECTS_TO_ALLOW) {
    const isAllowed = await readView<boolean>(publicClient, {
      address,
      abi,
      functionName: "allowed",
      args: [subject],
    });
    console.log(`  ${subject} → ${isAllowed}`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
