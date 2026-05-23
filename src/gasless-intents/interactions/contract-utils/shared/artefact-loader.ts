import * as fs from "node:fs";
import * as path from "node:path";
import type { Abi } from "viem";

const ARTEFACTS_DIR = path.resolve(
  __dirname,
  "../../../../../solidity/build-artefacts",
);

export function loadAbi(contractName: string): Abi {
  const artefactPath = path.join(ARTEFACTS_DIR, `${contractName}.json`);
  if (!fs.existsSync(artefactPath)) {
    throw new Error(
      `Artifact not found: ${artefactPath}. Run \`npx tsx solidity/scripts/build-artefacts.ts\` first.`,
    );
  }
  const artefact = JSON.parse(fs.readFileSync(artefactPath, "utf8"));
  return artefact.abi as Abi;
}
