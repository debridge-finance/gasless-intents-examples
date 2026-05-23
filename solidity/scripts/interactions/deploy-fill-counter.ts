import { encodeAbiParameters, decodeEventLog, type Hex } from "viem";
import { base } from "viem/chains";
import { deployToBase, ZERO_BYTES32 } from "../lib/deploy-lib";

const SUBJECT_ONLY_ABI = [{ type: "address" }] as const;

async function main(): Promise<void> {
  const ctx = await deployToBase({ contractName: "FillCounter" });

  console.log("Sending sanity-check onPreCall()...");
  const payload = encodeAbiParameters(SUBJECT_ONLY_ABI, [ctx.account.address]);

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
    throw new Error("No logs in receipt — FillRecorded not emitted");
  }
  const decoded = decodeEventLog({
    abi: ctx.abi,
    eventName: "FillRecorded",
    data: receipt.logs[0].data,
    topics: receipt.logs[0].topics,
  });
  const args = decoded.args as unknown as {
    subject: Hex;
    intentFillNumber: bigint;
    lifetimeFills: bigint;
  };
  if (args.subject.toLowerCase() !== ctx.account.address.toLowerCase()) {
    throw new Error(`Event subject ${args.subject} != deployer ${ctx.account.address}`);
  }
  if (args.intentFillNumber !== 1n || args.lifetimeFills !== 1n) {
    throw new Error(
      `Expected intentFillNumber=1 lifetimeFills=1, got ${args.intentFillNumber}/${args.lifetimeFills}`,
    );
  }
  console.log(
    `  Confirmed: FillRecorded subject=${args.subject} intentFillNumber=${args.intentFillNumber} lifetimeFills=${args.lifetimeFills}`,
  );
  console.log("Done.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
