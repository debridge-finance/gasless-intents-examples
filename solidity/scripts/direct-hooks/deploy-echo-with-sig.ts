import "dotenv/config";
import { randomBytes } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  formatEther,
  http,
  parseEther,
  type Abi,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";

const MIN_ETH_FOR_DEPLOY = parseEther("0.0005");
const ARTIFACT_PATH = path.resolve(__dirname, "../../build-artefacts/EchoWithSig.json");
const SANITY_MESSAGE = "deployed via solidity/scripts/deploy-echo-with-sig.ts";

async function main(): Promise<void> {
  const rawKey = process.env.SIGNER_PK;
  if (!rawKey) throw new Error("SIGNER_PK is not set in .env");
  const pk = (rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`) as Hex;
  const rpcUrl = process.env.BASE_RPC_URL || "https://mainnet.base.org";

  const artifact = JSON.parse(fs.readFileSync(ARTIFACT_PATH, "utf8"));
  const abi = artifact.abi as Abi;
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
      `Insufficient ETH on Base for deployment (need ≥ ${formatEther(MIN_ETH_FOR_DEPLOY)} ETH).`,
    );
  }

  console.log("Deploying EchoWithSig...");
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
  console.log(`  Gas used: ${deployReceipt.gasUsed} @ ${deployReceipt.effectiveGasPrice} wei`);
  console.log(
    `  Contract: ${contractAddress} (https://basescan.org/address/${contractAddress})`,
  );

  console.log("Sending sanity-check echoWithSig() — deployer signs and sends...");
  const chainId = base.id;
  const nonce = (`0x${randomBytes(32).toString("hex")}`) as Hex;
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
  const signature = await account.signTypedData({
    domain: {
      name: "EchoWithSig",
      version: "1",
      chainId,
      verifyingContract: contractAddress,
    },
    types: {
      EchoMessage: [
        { name: "user", type: "address" },
        { name: "nonce", type: "bytes32" },
        { name: "message", type: "string" },
        { name: "deadline", type: "uint256" },
      ],
    },
    primaryType: "EchoMessage",
    message: {
      user: account.address,
      nonce,
      message: SANITY_MESSAGE,
      deadline,
    },
  });
  if ((signature.length - 2) / 2 !== 65) {
    throw new Error(`Unexpected signature length: ${(signature.length - 2) / 2}`);
  }

  // Explicit gas: viem's estimateGas right after a fresh deploy can return a
  // stale/low value on the public Base RPC (load-balanced nodes). 120k is
  // ~2× the actual ~57k cost — generous but bounded.
  const echoHash = await walletClient.writeContract({
    address: contractAddress,
    abi,
    functionName: "echoWithSig",
    args: [account.address, nonce, SANITY_MESSAGE, deadline, signature],
    gas: 120_000n,
  });
  console.log(`  Tx: ${echoHash} (https://basescan.org/tx/${echoHash})`);
  const echoReceipt = await publicClient.waitForTransactionReceipt({ hash: echoHash });
  if (echoReceipt.status !== "success") {
    throw new Error(`echoWithSig() reverted in tx ${echoHash}`);
  }
  if (echoReceipt.logs.length === 0) {
    throw new Error("No logs in receipt — MessageEchoed not emitted");
  }
  const decoded = decodeEventLog({
    abi,
    eventName: "MessageEchoed",
    data: echoReceipt.logs[0].data,
    topics: echoReceipt.logs[0].topics,
  });
  const args = decoded.args as { user: Address; nonce: Hex; message: string; signature: Hex };
  if (args.user.toLowerCase() !== account.address.toLowerCase()) {
    throw new Error(`Event user ${args.user} != deployer ${account.address}`);
  }
  if (args.nonce.toLowerCase() !== nonce.toLowerCase()) {
    throw new Error("Event nonce mismatch");
  }
  if (args.message !== SANITY_MESSAGE) {
    throw new Error("Event message mismatch");
  }
  console.log("  Confirmed: MessageEchoed event matches signed payload");
  console.log("Done.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
