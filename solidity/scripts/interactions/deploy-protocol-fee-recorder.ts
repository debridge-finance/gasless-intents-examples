import { encodeAbiParameters } from "viem";
import { base } from "viem/chains";
import { deployToBase, ZERO_BYTES32 } from "../lib/deploy-lib";

const SUBJECT_ONLY_ABI = [{ type: "address" }] as const;

async function main(): Promise<void> {
  const ctx = await deployToBase({ contractName: "ProtocolFeeRecorder" });

  // Sanity: onPreCall is a no-op for this contract; we still call it to verify
  // the contract is callable and the selector is wired up. The same-chain
  // post-call sanity is more involved (requires building a context struct
  // with preSwapResults);
  console.log("Sending sanity-check onPreCall() (no-op)...");
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
  console.log(`  Confirmed: contract is callable`);
  console.log("Done.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
