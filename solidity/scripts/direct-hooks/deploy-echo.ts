import "dotenv/config";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  createPublicClient,
  createWalletClient,
  formatEther,
  http,
  parseEther,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";
import { recordDeployment } from "../lib/ledger";

const MIN_ETH_FOR_DEPLOY = parseEther("0.0005");
const ARTIFACT_PATH = path.resolve(__dirname, "../../build-artefacts/Echo.json");
const SANITY_ECHO_MESSAGE = "deployed via solidity/scripts/deploy-echo.ts";

async function main() {
  const rawKey = process.env.SIGNER_PK;
  if (!rawKey) throw new Error("SIGNER_PK is not set in .env");
  const pk = (rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`) as Hex;
  const rpcUrl = process.env.BASE_RPC_URL || "https://mainnet.base.org";

  const artifact = JSON.parse(fs.readFileSync(ARTIFACT_PATH, "utf8"));
  const abi = artifact.abi;
  const rawBytecode: string = artifact.data?.bytecode?.object;
  if (typeof rawBytecode !== "string" || rawBytecode.length === 0) {
    throw new Error(`Bytecode not found at .data.bytecode.object in ${ARTIFACT_PATH}`);
  }
  const bytecode = (rawBytecode.startsWith("0x") ? rawBytecode : `0x${rawBytecode}`) as Hex;

  const account = privateKeyToAccount(pk);
  const publicClient = createPublicClient({ chain: base, transport: http(rpcUrl) });
  const walletClient = createWalletClient({ account, chain: base, transport: http(rpcUrl) });

  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`Deployer: ${account.address}`);
  console.log(`Balance: ${formatEther(balance)} ETH on Base`);
  if (balance < MIN_ETH_FOR_DEPLOY) {
    throw new Error(
      `Insufficient ETH on Base for deployment (need ≥ ${formatEther(MIN_ETH_FOR_DEPLOY)} ETH).`
    );
  }

  console.log("Deploying Echo...");
  const deployHash = await walletClient.deployContract({ abi, bytecode, args: [] });
  console.log(`  Tx: ${deployHash} (https://basescan.org/tx/${deployHash})`);
  const deployReceipt = await publicClient.waitForTransactionReceipt({ hash: deployHash });
  if (deployReceipt.status !== "success") {
    throw new Error(`Deployment reverted in tx ${deployHash}`);
  }
  const contractAddress = deployReceipt.contractAddress as Address | null;
  if (!contractAddress) {
    throw new Error(`Receipt for ${deployHash} has no contractAddress`);
  }
  console.log(`  Confirmed in block ${deployReceipt.blockNumber}`);
  console.log(
    `  Gas used: ${deployReceipt.gasUsed} @ ${deployReceipt.effectiveGasPrice} wei`
  );
  console.log(
    `  Contract: ${contractAddress} (https://basescan.org/address/${contractAddress})`
  );

  recordDeployment("Echo", {
    address: contractAddress,
    deployTxHash: deployHash,
    blockNumber: Number(deployReceipt.blockNumber),
  });

  // Alchemy rate-limits "in-flight" transactions for delegated (EIP-7702)
  // accounts — even after `waitForTransactionReceipt` confirms a tx on-chain,
  // the next `eth_sendRawTransaction` from the same sender can be rejected
  // for a few seconds. Mirrors the buffer in lib/deploy-lib.ts.
  await new Promise((r) => setTimeout(r, 4000));

  console.log("Sending sanity-check echo()...");
  const echoHash = await walletClient.writeContract({
    address: contractAddress,
    abi,
    functionName: "echo",
    args: [SANITY_ECHO_MESSAGE],
  });
  console.log(`  Tx: ${echoHash} (https://basescan.org/tx/${echoHash})`);
  const echoReceipt = await publicClient.waitForTransactionReceipt({ hash: echoHash });
  if (echoReceipt.status !== "success") {
    throw new Error(`echo() reverted in tx ${echoHash}`);
  }
  console.log("  Confirmed");
  console.log("Done.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
