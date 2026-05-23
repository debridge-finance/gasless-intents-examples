/**
 * Sanity call against the deployed Echo contract on Base. Sends one
 * `echo("...")` transaction with viem-encoded calldata and decodes the
 * `Echoed(address indexed sender, string message)` event from the receipt.
 *
 * Echo address is read from `solidity/build-artefacts/deployed-base.json`
 * (the ledger written by deploy-echo.ts).
 */
import "dotenv/config";
import {
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  http,
  parseAbi,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";
import { requireDeployedAddress } from "@gasless-intents/interactions/contract-utils/shared/deployed-addresses";

const ECHO_ABI = parseAbi([
  "function echo(string message) external",
  "event Echoed(address indexed sender, string message)",
]);

const MESSAGE = "sanity-test";

async function main(): Promise<void> {
  const rawKey = process.env.SIGNER_PK;
  if (!rawKey) throw new Error("SIGNER_PK is not set in .env");
  const pk = (rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`) as Hex;
  const rpcUrl = process.env.BASE_RPC_URL || "https://mainnet.base.org";

  const address = requireDeployedAddress("Echo");
  const account = privateKeyToAccount(pk);
  const publicClient = createPublicClient({ chain: base, transport: http(rpcUrl) });
  const walletClient = createWalletClient({ account, chain: base, transport: http(rpcUrl) });

  console.log(`Echo: ${address}`);
  console.log(`Caller: ${account.address}`);

  console.log(`Sending echo("${MESSAGE}")...`);
  const hash = await walletClient.writeContract({
    address,
    abi: ECHO_ABI,
    functionName: "echo",
    args: [MESSAGE],
    account,
    chain: base,
  } as any);
  console.log(`  Tx: ${hash} (https://basescan.org/tx/${hash})`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error(`echo() reverted in tx ${hash}`);
  }
  const log = (receipt.logs as unknown as Array<{ topics: readonly Hex[]; data: Hex }>).find(
    (l) => l.topics && l.topics[0] !== undefined,
  );
  if (!log) throw new Error("No Echoed event in receipt");
  const decoded = decodeEventLog({
    abi: ECHO_ABI,
    eventName: "Echoed",
    data: log.data,
    topics: log.topics as [signature: Hex, ...args: Hex[]],
  });
  const args = decoded.args as unknown as { sender: Address; message: string };
  if (args.sender.toLowerCase() !== account.address.toLowerCase()) {
    throw new Error(`Event sender ${args.sender} != caller ${account.address}`);
  }
  if (args.message !== MESSAGE) {
    throw new Error(`Event message ${args.message} != ${MESSAGE}`);
  }
  console.log(`  Confirmed: Echoed sender=${args.sender} message="${args.message}"`);
  console.log("Done.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
