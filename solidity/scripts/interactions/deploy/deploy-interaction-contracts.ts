import { execFileSync } from "node:child_process";
import * as path from "node:path";
import { readLedger } from "../../lib/ledger";

const DEPLOY_DIR = __dirname;
const UTILITIES_DIR = path.resolve(__dirname, "../../utilities");

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

function parseFlags(): { dryRun: boolean; only: Set<string>; skip: Set<string> } {
  const args = process.argv.slice(2);
  let dryRun = false;
  const only = new Set<string>();
  const skip = new Set<string>();
  for (let i = 0; i < args.length; ++i) {
    const a = args[i];
    if (a === "--dry-run") dryRun = true;
    else if (a === "--only") only.add(args[++i]);
    else if (a === "--skip") skip.add(args[++i]);
    else throw new Error(`Unknown arg: ${a}`);
  }
  return { dryRun, only, skip };
}

function main(): void {
  const { dryRun, only, skip } = parseFlags();
  const plan = HOOK_CONTRACTS.filter((name) => {
    if (only.size > 0 && !only.has(name)) return false;
    if (skip.has(name)) return false;
    return true;
  });

  console.log("Build artefacts before deployment:");
  if (!dryRun) {
    execFileSync("npx", ["tsx", path.join(UTILITIES_DIR, "build-artefacts.ts")], {
      stdio: "inherit",
    });
  } else {
    console.log("  (skipped — dry run)");
  }

  console.log("");
  console.log(`Planned deployments (${plan.length}):`);
  for (const name of plan) {
    console.log(`  - ${name} via interactions/deploy/deploy-${kebabCase(name)}.ts`);
  }

  if (dryRun) {
    console.log("\nDry run complete — no transactions broadcast.");
    return;
  }

  console.log("");
  for (const name of plan) {
    const script = path.join(DEPLOY_DIR, `deploy-${kebabCase(name)}.ts`);
    console.log(`\n=== ${name} ===`);
    execFileSync("npx", ["tsx", script], { stdio: "inherit" });
  }

  console.log("\n=== Deployment summary ===");
  const ledger = readLedger();
  const table = ["| Contract | Address |", "|----------|---------|"];
  for (const name of plan) {
    const entry = ledger.contracts[name];
    if (!entry) {
      table.push(`| ${name} | NOT RECORDED |`);
    } else {
      table.push(
        `| ${name} | [\`${entry.address}\`](https://basescan.org/address/${entry.address}) |`,
      );
    }
  }
  console.log(table.join("\n"));
  console.log("\nNext step:");
  console.log("  npx tsx solidity/scripts/interactions/verify/verify-interaction-contracts.ts");
}

try {
  main();
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}
