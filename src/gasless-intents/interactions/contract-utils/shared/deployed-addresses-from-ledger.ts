import * as fs from "node:fs";
import * as path from "node:path";
import type { Address, Hex } from "viem";

/**
 * Dynamic deployed-address lookup that reads
 * `solidity/build-artefacts/deployed-base.json`.
 */

const LEDGER_PATH = path.resolve(
  __dirname,
  "../../../../../solidity/build-artefacts/deployed-base.json",
);

const ZERO = "0x0000000000000000000000000000000000000000" as Address;

type Ledger = {
  chainId: number;
  lastUpdated: string | null;
  contracts: Record<
    string,
    { address: Address; deployTxHash: Hex; blockNumber: number }
  >;
};

export function readLedger(): Ledger {
  if (!fs.existsSync(LEDGER_PATH)) {
    throw new Error(`Ledger not found: ${LEDGER_PATH}`);
  }
  return JSON.parse(fs.readFileSync(LEDGER_PATH, "utf8")) as Ledger;
}

export function requireDeployedAddress(name: string): Address {
  const ledger = readLedger();
  const entry = ledger.contracts[name];
  if (!entry || entry.address === ZERO) {
    throw new Error(
      `${name} is not deployed (address missing or zero in deployed-base.json). ` +
        `Run \`npx tsx solidity/scripts/interactions/deploy/deploy-${kebabCase(name)}.ts\` first.`,
    );
  }
  return entry.address;
}

function kebabCase(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}
