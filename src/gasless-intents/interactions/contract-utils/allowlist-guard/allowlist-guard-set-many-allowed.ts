/**
 * Batch-toggle addresses on the AllowlistGuard allowlist.
 *
 * Usage:
 *   npx tsx .../allowlist-guard-set-many-allowed.ts --addresses 0x1,0x2,0x3 --allowed true
 *   npx tsx .../allowlist-guard-set-many-allowed.ts --addresses-file ./batch.json --allowed false
 *
 * --addresses-file accepts a JSON array of addresses.
 */
import * as fs from "node:fs";
import { isAddress, type Address } from "viem";
import { loadAbi } from "../shared/abis";
import { requireDeployedAddress } from "../shared/deployed-addresses";
import { getBaseClients, writeTx } from "../shared/base-clients";

function parseArgs(): { addresses: Address[]; isAllowed: boolean } {
  const args = process.argv.slice(2);
  let inline: string | null = null;
  let file: string | null = null;
  let boolStr: string | null = null;
  for (let i = 0; i < args.length; ++i) {
    const a = args[i];
    if (a === "--addresses") inline = args[++i];
    else if (a === "--addresses-file") file = args[++i];
    else if (a === "--allowed") boolStr = args[++i];
    else throw new Error(`Unknown arg: ${a}`);
  }
  if (boolStr !== "true" && boolStr !== "false") {
    throw new Error("--allowed must be true|false");
  }
  let raw: string[];
  if (inline) raw = inline.split(",").map((s) => s.trim()).filter(Boolean);
  else if (file) raw = JSON.parse(fs.readFileSync(file, "utf8")) as string[];
  else throw new Error("Provide --addresses or --addresses-file");

  for (const addr of raw) {
    if (!isAddress(addr)) throw new Error(`Invalid address: ${addr}`);
  }
  return { addresses: raw as Address[], isAllowed: boolStr === "true" };
}

async function main(): Promise<void> {
  const { addresses, isAllowed } = parseArgs();
  const address = requireDeployedAddress("AllowlistGuard");
  const abi = loadAbi("AllowlistGuard");
  const { account, publicClient, walletClient } = getBaseClients();

  console.log(`AllowlistGuard: ${address}`);
  console.log(`  setManyAllowed(${addresses.length} addresses, ${isAllowed})`);

  const hash = await writeTx(walletClient, publicClient, account, {
    address,
    abi,
    functionName: "setManyAllowed",
    args: [addresses, isAllowed],
  });
  console.log(`  Tx: ${hash} (https://basescan.org/tx/${hash})`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error(`setManyAllowed reverted in tx ${hash}`);
  }
  console.log(`  Confirmed in block ${receipt.blockNumber}; ${receipt.logs.length} AllowedUpdated events`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
