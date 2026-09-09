import * as fs from "node:fs";
import * as path from "node:path";

const ETHERSCAN_V2_API = "https://api.etherscan.io/v2/api";
const BASE_CHAIN_ID = "8453";
const POLL_INTERVAL_MS = 4_000;
const POLL_TIMEOUT_MS = 120_000;

const SOLIDITY_DIR = path.resolve(__dirname, "../..");
const ARTEFACTS_DIR = path.join(SOLIDITY_DIR, "build-artefacts");

type Metadata = {
  compiler: { version: string };
  settings?: {
    optimizer?: { enabled: boolean; runs: number };
    evmVersion?: string;
    metadata?: { bytecodeHash?: string };
    remappings?: string[];
  };
  sources?: Record<string, unknown>;
};

function loadMetadata(contractName: string): Metadata {
  const metadataPath = path.join(ARTEFACTS_DIR, `${contractName}_metadata.json`);
  return JSON.parse(fs.readFileSync(metadataPath, "utf8")) as Metadata;
}

function collectSources(metadata: Metadata): Record<string, { content: string }> {
  if (!metadata.sources) {
    throw new Error("Metadata missing 'sources' field — rerun build-artefacts.ts");
  }
  const out: Record<string, { content: string }> = {};
  for (const sourcePath of Object.keys(metadata.sources)) {
    const onDisk = path.join(SOLIDITY_DIR, sourcePath);
    if (!fs.existsSync(onDisk)) {
      throw new Error(`Source file referenced in metadata not on disk: ${onDisk}`);
    }
    out[sourcePath] = { content: fs.readFileSync(onDisk, "utf8") };
  }
  return out;
}

function buildStandardJsonInput(metadata: Metadata): string {
  const settings = metadata.settings ?? {};
  return JSON.stringify({
    language: "Solidity",
    sources: collectSources(metadata),
    settings: {
      optimizer: settings.optimizer ?? { enabled: true, runs: 200 },
      evmVersion: settings.evmVersion ?? "cancun",
      metadata: settings.metadata ?? { bytecodeHash: "ipfs" },
      remappings: settings.remappings ?? [],
      outputSelection: {
        "*": { "*": ["abi", "evm.bytecode", "evm.deployedBytecode", "metadata"] },
      },
    },
  });
}

async function submit(
  apiKey: string,
  address: string,
  contractPath: string,
  contractName: string,
  compilerVersion: string,
  metadata: Metadata,
): Promise<string> {
  const body = new URLSearchParams({
    module: "contract",
    action: "verifysourcecode",
    contractaddress: address,
    sourceCode: buildStandardJsonInput(metadata),
    codeformat: "solidity-standard-json-input",
    contractname: `${contractPath}:${contractName}`,
    compilerversion: compilerVersion,
    constructorArguements: "",
    licenseType: "3",
  });

  const url = new URL(ETHERSCAN_V2_API);
  url.searchParams.set("chainid", BASE_CHAIN_ID);
  url.searchParams.set("apikey", apiKey);
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await res.json()) as { status: string; message: string; result: string };
  if (json.status !== "1") {
    if (/already verified/i.test(json.result)) {
      console.log(`Already verified: ${json.result}`);
      process.exit(0);
    }
    throw new Error(`Submission failed: ${json.message} — ${json.result}`);
  }
  return json.result;
}

async function poll(apiKey: string, guid: string): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < POLL_TIMEOUT_MS) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const url = new URL(ETHERSCAN_V2_API);
    url.searchParams.set("chainid", BASE_CHAIN_ID);
    url.searchParams.set("module", "contract");
    url.searchParams.set("action", "checkverifystatus");
    url.searchParams.set("guid", guid);
    url.searchParams.set("apikey", apiKey);
    const res = await fetch(url);
    const json = (await res.json()) as { status: string; message: string; result: string };
    if (json.status === "1") {
      console.log(`  ${json.result}`);
      return;
    }
    if (/pending/i.test(json.result)) {
      console.log(`  pending...`);
      continue;
    }
    throw new Error(`Verification failed: ${json.message} — ${json.result}`);
  }
  throw new Error(`Timed out after ${POLL_TIMEOUT_MS / 1000}s waiting for verification result`);
}

export async function verifyOnBasescan(opts: {
  contractName: string;
  contractPath: string;
  cliScriptName: string;
}): Promise<void> {
  const apiKey = process.env.ETHERSCAN_API_KEY;
  if (!apiKey) throw new Error("ETHERSCAN_API_KEY is not set in .env");

  const address = process.argv[2];
  if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
    throw new Error(`Usage: npx tsx ${opts.cliScriptName} <0xContractAddress>`);
  }

  const metadata = loadMetadata(opts.contractName);
  const compilerVersion = `v${metadata.compiler.version}`;

  console.log(`Verifying ${address} as ${opts.contractPath}:${opts.contractName}`);
  console.log(`Compiler: ${compilerVersion}`);
  console.log(`Submitting to Etherscan v2 API (chainid=${BASE_CHAIN_ID})...`);
  const guid = await submit(apiKey, address, opts.contractPath, opts.contractName, compilerVersion, metadata);
  console.log(`  GUID: ${guid}`);

  console.log("Polling for result...");
  await poll(apiKey, guid);

  console.log(`Done: https://basescan.org/address/${address}#code`);
}
