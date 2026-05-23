import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

const SOLIDITY_DIR = path.resolve(__dirname, "../..");
const FORGE_BIN = process.env.FORGE_BIN || "/Users/damir/.foundry/bin/forge";

const CONTRACTS = [
  "Echo",
  "EchoWithSig",
  "LoggingInteractionHook",
  "FillCounter",
  "ProtocolFeeRecorder",
  "AllowlistGuard",
  "RewardMinter",
  "FillCapEnforcer",
];

const ARTEFACTS_DIR = path.join(SOLIDITY_DIR, "build-artefacts");

function writeArtefactsFor(contract: string): void {
  const forgeOut = path.join(SOLIDITY_DIR, "out", `${contract}.sol`, `${contract}.json`);
  if (!fs.existsSync(forgeOut)) {
    throw new Error(`Forge output not found: ${forgeOut}`);
  }
  const forge = JSON.parse(fs.readFileSync(forgeOut, "utf8"));
  if (!forge.abi || !forge.bytecode?.object) {
    throw new Error(`Forge output missing abi/bytecode at ${forgeOut}`);
  }
  if (!forge.metadata) {
    throw new Error(
      `Forge output missing metadata at ${forgeOut}. ` +
        `Ensure foundry.toml has extra_output = ["metadata"].`,
    );
  }

  const artefact = {
    abi: forge.abi,
    data: { bytecode: { object: forge.bytecode.object } },
  };
  const artefactPath = path.join(ARTEFACTS_DIR, `${contract}.json`);
  fs.writeFileSync(artefactPath, JSON.stringify(artefact, null, 2) + "\n");
  console.log(`Wrote ${artefactPath}`);

  const metadata =
    typeof forge.metadata === "string" ? JSON.parse(forge.metadata) : forge.metadata;
  const metadataPath = path.join(ARTEFACTS_DIR, `${contract}_metadata.json`);
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2) + "\n");
  console.log(`Wrote ${metadataPath}`);
}

function main(): void {
  console.log(`Compiling with ${FORGE_BIN} build (cwd=${SOLIDITY_DIR})...`);
  execFileSync(FORGE_BIN, ["build"], { cwd: SOLIDITY_DIR, stdio: "inherit" });

  fs.mkdirSync(ARTEFACTS_DIR, { recursive: true });

  for (const contract of CONTRACTS) {
    writeArtefactsFor(contract);
  }

  const firstMetadata = JSON.parse(
    fs.readFileSync(path.join(ARTEFACTS_DIR, `${CONTRACTS[0]}_metadata.json`), "utf8"),
  );
  console.log(
    `compiler=${firstMetadata.compiler?.version} optimizer=${JSON.stringify(firstMetadata.settings?.optimizer)} evm=${firstMetadata.settings?.evmVersion} bytecodeHash=${firstMetadata.settings?.metadata?.bytecodeHash}`,
  );
  console.log("Done.");
}

main();
