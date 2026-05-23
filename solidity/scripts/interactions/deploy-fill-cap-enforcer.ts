import { encodeAbiParameters, decodeEventLog, type Hex } from "viem";
import { base } from "viem/chains";
import { deployToBase, ZERO_BYTES32 } from "../lib/deploy-lib";

const SUBJECT_ONLY_ABI = [{ type: "address" }] as const;

async function main(): Promise<void> {
  const ctx = await deployToBase({ contractName: "FillCapEnforcer" });

  const payload = encodeAbiParameters(SUBJECT_ONLY_ABI, [ctx.account.address]);

  // Step 1: no cap set → onPreCall should succeed.
  console.log("Sanity step 1/3: onPreCall() with no cap (expect success)...");
  const hashA = await ctx.walletClient.writeContract({
    address: ctx.contractAddress,
    abi: ctx.abi,
    functionName: "onPreCall",
    args: [ZERO_BYTES32, ZERO_BYTES32, payload],
    account: ctx.account,
    chain: base,
    gas: 200_000n,
  });
  console.log(`  Tx: ${hashA} (https://basescan.org/tx/${hashA})`);
  const receiptA = await ctx.publicClient.waitForTransactionReceipt({ hash: hashA });
  if (receiptA.status !== "success") {
    throw new Error(`onPreCall() reverted in tx ${hashA}`);
  }
  if (receiptA.logs.length === 0) {
    throw new Error("No logs in receipt — PreCallAccepted not emitted");
  }
  const decodedA = decodeEventLog({
    abi: ctx.abi,
    eventName: "PreCallAccepted",
    data: receiptA.logs[0].data,
    topics: receiptA.logs[0].topics,
  });
  const argsA = decodedA.args as { subject: Hex; fillNumber: bigint; cap: bigint };
  console.log(
    `  Confirmed: PreCallAccepted subject=${argsA.subject} fillNumber=${argsA.fillNumber} cap=${argsA.cap}`,
  );
  // Alchemy in-flight rate-limit buffer (see deploy-lib.ts).
  await new Promise((r) => setTimeout(r, 4000));

  // Step 2: set cap=1 for deployer.
  console.log("Sanity step 2/3: setCap(deployer, 1)...");
  const setHash = await ctx.walletClient.writeContract({
    address: ctx.contractAddress,
    abi: ctx.abi,
    functionName: "setCap",
    args: [ctx.account.address, 1n],
    account: ctx.account,
    chain: base,
    gas: 200_000n,
  });
  console.log(`  Tx: ${setHash} (https://basescan.org/tx/${setHash})`);
  const setReceipt = await ctx.publicClient.waitForTransactionReceipt({ hash: setHash });
  if (setReceipt.status !== "success") {
    throw new Error(`setCap() reverted in tx ${setHash}`);
  }
  // Alchemy in-flight rate-limit buffer (see deploy-lib.ts).
  await new Promise((r) => setTimeout(r, 4000));

  // Step 3: onPreCall against a fresh intentId → succeeds (fill 1 ≤ cap 1).
  console.log("Sanity step 3/3: onPreCall() with cap=1 and fresh intentId (expect success)...");
  const freshIntentId = "0x" + "00".repeat(31) + "01" as Hex;
  const hashB = await ctx.walletClient.writeContract({
    address: ctx.contractAddress,
    abi: ctx.abi,
    functionName: "onPreCall",
    args: [freshIntentId, ZERO_BYTES32, payload],
    account: ctx.account,
    chain: base,
    gas: 200_000n,
  });
  console.log(`  Tx: ${hashB} (https://basescan.org/tx/${hashB})`);
  const receiptB = await ctx.publicClient.waitForTransactionReceipt({ hash: hashB });
  if (receiptB.status !== "success") {
    throw new Error(`onPreCall() reverted in tx ${hashB}`);
  }
  console.log("  Confirmed: cap=1 first call succeeds. Second call to same intentId would revert HardCapExceeded.");
  console.log("Done.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
