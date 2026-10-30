import * as fs from "node:fs";
import * as path from "node:path";
import type { Address, Hex } from "viem";

const LEDGER_PATH = path.resolve(__dirname, "../../build-artefacts/deployed-base.json");

export type LedgerEntry = {
  address: Address;
  deployTxHash: Hex;
  blockNumber: number;
};

export type Ledger = {
  chainId: number;
  lastUpdated: string | null;
  contracts: Record<string, LedgerEntry>;
};

export function readLedger(): Ledger {
  if (!fs.existsSync(LEDGER_PATH)) {
    return { chainId: 8453, lastUpdated: null, contracts: {} };
  }
  return JSON.parse(fs.readFileSync(LEDGER_PATH, "utf8")) as Ledger;
}

export function writeLedger(ledger: Ledger): void {
  fs.writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 2) + "\n");
}

export function recordDeployment(name: string, entry: LedgerEntry): void {
  const ledger = readLedger();
  ledger.contracts[name] = entry;
  ledger.lastUpdated = new Date().toISOString();
  writeLedger(ledger);
  console.log(`Ledger updated: ${name} → ${entry.address}`);
}

export function getDeployedAddress(name: string): Address | null {
  const ledger = readLedger();
  return ledger.contracts[name]?.address ?? null;
}

export function requireDeployedAddress(name: string): Address {
  const addr = getDeployedAddress(name);
  if (!addr) {
    throw new Error(
      `${name} address not in ${path.relative(process.cwd(), LEDGER_PATH)}. ` +
        `Deploy via solidity/scripts/deploy-${kebabCase(name)}.ts first.`,
    );
  }
  return addr;
}

function kebabCase(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}
