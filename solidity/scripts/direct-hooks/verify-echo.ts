import "dotenv/config";
import * as fs from "node:fs";
import * as path from "node:path";

const ETHERSCAN_V2_API = "https://api.etherscan.io/v2/api";
const BASE_CHAIN_ID = "8453";
const CONTRACT_PATH = "contracts/direct-hooks/Echo.sol";
const CONTRACT_NAME = "Echo";
const POLL_INTERVAL_MS = 4_000;
const POLL_TIMEOUT_MS = 120_000;

const SOURCE_PATH = path.resolve(__dirname, "../../contracts/direct-hooks/Echo.sol");
const METADATA_PATH = path.resolve(__dirname, "../../build-artefacts/Echo_metadata.json");

function buildStandardJsonInput(): string {
  const source = fs.readFileSync(SOURCE_PATH, "utf8");
  const metadata = JSON.parse(fs.readFileSync(METADATA_PATH, "utf8"));
  const settings = metadata.settings ?? {};
  return JSON.stringify({
    language: "Solidity",
    sources: { [CONTRACT_PATH]: { content: source } },
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

async function submit(apiKey: string, address: string, compilerVersion: string): Promise<string> {
  const body = new URLSearchParams({
    module: "contract",
    action: "verifysourcecode",
    contractaddress: address,
    sourceCode: buildStandardJsonInput(),
    codeformat: "solidity-standard-json-input",
    contractname: `${CONTRACT_PATH}:${CONTRACT_NAME}`,
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

async function main() {
  const apiKey = process.env.ETHERSCAN_API_KEY;
  if (!apiKey) throw new Error("ETHERSCAN_API_KEY is not set in .env");

  const address = process.argv[2];
  if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
    throw new Error("Usage: npx tsx solidity/scripts/direct-hooks/verify-echo.ts <0xContractAddress>");
  }

  const metadata = JSON.parse(fs.readFileSync(METADATA_PATH, "utf8"));
  const compilerVersion = `v${metadata.compiler.version}`;

  console.log(`Verifying ${address} as ${CONTRACT_PATH}:${CONTRACT_NAME}`);
  console.log(`Compiler: ${compilerVersion}`);
  console.log(`Submitting to Etherscan v2 API (chainid=${BASE_CHAIN_ID})...`);
  const guid = await submit(apiKey, address, compilerVersion);
  console.log(`  GUID: ${guid}`);

  console.log("Polling for result...");
  await poll(apiKey, guid);

  console.log(`Done: https://basescan.org/address/${address}#code`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
