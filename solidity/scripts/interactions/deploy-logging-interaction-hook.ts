import { encodeAbiParameters, decodeEventLog, type Hex } from "viem";
import { base } from "viem/chains";
import { deployToBase, ZERO_BYTES32 } from "../lib/deploy-lib";

const LOG_PAYLOAD_ABI = [
  { type: "string" },
  { type: "address" },
  { type: "uint256" },
] as const;

async function main(): Promise<void> {
  const ctx = await deployToBase({ contractName: "LoggingInteractionHook" });

  console.log("Sending sanity-check onPreCall()...");
  const payload = encodeAbiParameters(LOG_PAYLOAD_ABI, [
    "deploy-sanity",
    ctx.account.address,
    0n,
  ]);

  const hash = await ctx.walletClient.writeContract({
    address: ctx.contractAddress,
    abi: ctx.abi,
    functionName: "onPreCall",
    args: [ZERO_BYTES32, ZERO_BYTES32, payload],
    account: ctx.account,
    chain: base,
    gas: 200_000n,
  });
  console.log(`  Tx: ${hash} (https://basescan.org/tx/${hash})`);
  const receipt = await ctx.publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error(`onPreCall() reverted in tx ${hash}`);
  }
  if (receipt.logs.length === 0) {
    throw new Error("No logs in receipt — PreCallLogged not emitted");
  }
  const decoded = decodeEventLog({
    abi: ctx.abi,
    eventName: "PreCallLogged",
    data: receipt.logs[0].data,
    topics: receipt.logs[0].topics,
  });
  const args = decoded.args as unknown as { subject: Hex; fillNumber: bigint };
  if (args.subject.toLowerCase() !== ctx.account.address.toLowerCase()) {
    throw new Error(`Event subject ${args.subject} != deployer ${ctx.account.address}`);
  }
  if (args.fillNumber !== 1n) {
    throw new Error(`Expected fillNumber=1, got ${args.fillNumber}`);
  }
  console.log(`  Confirmed: PreCallLogged subject=${args.subject} fillNumber=${args.fillNumber}`);
  console.log("Done.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
