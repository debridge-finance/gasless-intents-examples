import "dotenv/config";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  createPublicClient,
  createWalletClient,
  formatEther,
  http,
  parseEther,
  type Abi,
  type Account,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";
import { recordDeployment } from "./ledger";

const MIN_ETH_FOR_DEPLOY = parseEther("0.0005");
const ARTEFACTS_DIR = path.resolve(__dirname, "../../build-artefacts");

export type DeployedContext = {
  contractAddress: Address;
  abi: Abi;
  publicClient: PublicClient;
  walletClient: WalletClient;
  account: Account;
};

export async function deployToBase(opts: {
  contractName: string;
  constructorArgs?: readonly unknown[];
}): Promise<DeployedContext> {
  const rawKey = process.env.SIGNER_PK;
  if (!rawKey) throw new Error("SIGNER_PK is not set in .env");
  const pk = (rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`) as Hex;
  const rpcUrl = process.env.BASE_RPC_URL || "https://mainnet.base.org";

  const artefactPath = path.join(ARTEFACTS_DIR, `${opts.contractName}.json`);
  if (!fs.existsSync(artefactPath)) {
    throw new Error(
      `Artifact not found: ${artefactPath}. Run \`npx tsx solidity/scripts/utilities/build-artefacts.ts\` first.`,
    );
  }
  const artifact = JSON.parse(fs.readFileSync(artefactPath, "utf8"));
  const abi = artifact.abi as Abi;
  const rawBytecode: string = artifact.data?.bytecode?.object;
  if (typeof rawBytecode !== "string" || rawBytecode.length === 0) {
    throw new Error(`Bytecode not found at .data.bytecode.object in ${artefactPath}`);
  }
  const bytecode = (rawBytecode.startsWith("0x") ? rawBytecode : `0x${rawBytecode}`) as Hex;

  const account = privateKeyToAccount(pk);
  const publicClient = createPublicClient({ chain: base, transport: http(rpcUrl) }) as PublicClient;
  const walletClient = createWalletClient({ account, chain: base, transport: http(rpcUrl) }) as WalletClient;

  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`Deployer: ${account.address}`);
  console.log(`Balance: ${formatEther(balance)} ETH on Base`);
  if (balance < MIN_ETH_FOR_DEPLOY) {
    throw new Error(
      `Insufficient ETH on Base for deployment (need ≥ ${formatEther(MIN_ETH_FOR_DEPLOY)} ETH).`,
    );
  }

  console.log(`Deploying ${opts.contractName}...`);
  const deployHash = await walletClient.deployContract({
    abi,
    bytecode,
    args: (opts.constructorArgs ?? []) as never,
    account,
    chain: base,
  });
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

  recordDeployment(opts.contractName, {
    address: contractAddress,
    deployTxHash: deployHash,
    blockNumber: Number(deployReceipt.blockNumber),
  });

  // Alchemy rate-limits "in-flight" transactions for delegated (EIP-7702)
  // accounts — even after `waitForTransactionReceipt` confirms a tx on-chain,
  // the next `eth_sendRawTransaction` from the same sender can be rejected
  // with "in-flight transaction limit reached for delegated accounts" for a
  // few seconds. A small delay lets the rate-limiter clear before the
  // caller's post-deploy sanity write goes out.
  await new Promise((r) => setTimeout(r, 4000));

  return { contractAddress, abi, publicClient, walletClient, account };
}

export const ZERO_BYTES32 = "0x0000000000000000000000000000000000000000000000000000000000000000" as Hex;
