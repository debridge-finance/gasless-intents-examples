import "dotenv/config";
import { execFileSync } from "node:child_process";
import * as path from "node:path";
import { readLedger } from "../../lib/ledger";

const VERIFY_DIR = __dirname;
const ZERO_ADDR = "0x0000000000000000000000000000000000000000";

const HOOK_CONTRACTS = [
  "LoggingInteractionHook",
  "FillCounter",
  "ProtocolFeeRecorder",
  "RewardMinter",
  "FillCapEnforcer",
];

function kebabCase(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

function main(): void {
  const ledger = readLedger();
  const planned = HOOK_CONTRACTS.filter((name) => {
    const entry = ledger.contracts[name];
    return entry && entry.address !== ZERO_ADDR;
  });
  if (planned.length === 0) {
    console.log(
      "No interaction contracts in deployed-base.json. Run deploy/deploy-interaction-contracts.ts first.",
    );
    return;
  }

  console.log(`Verifying ${planned.length} interaction contracts on Basescan...`);
  for (const name of planned) {
    const entry = ledger.contracts[name];
    const script = path.join(VERIFY_DIR, `verify-${kebabCase(name)}.ts`);
    console.log(`\n=== ${name} (${entry.address}) ===`);
    try {
      execFileSync("npx", ["tsx", script, entry.address], { stdio: "inherit" });
    } catch (err) {
      // verifyOnBasescan exits with non-zero on permanent failure; "already
      // verified" exits 0. Surface the failure but keep going so a single
      // contract issue doesn't block the rest.
      console.error(
        `${name}: verify failed — ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
  console.log("\nDone.");
}

try {
  main();
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}
