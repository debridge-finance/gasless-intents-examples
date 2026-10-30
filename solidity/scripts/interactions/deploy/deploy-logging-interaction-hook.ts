import { deployToBase, ZERO_BYTES32 } from "../../lib/deploy-lib";

async function main(): Promise<void> {
  const ctx = await deployToBase({ contractName: "LoggingInteractionHook" });

  console.log("Reading initial fillCount()...");
  const fillCount = await ctx.publicClient.readContract({
    address: ctx.contractAddress,
    abi: ctx.abi,
    functionName: "fillCount",
    args: [ZERO_BYTES32],
  } as never) as bigint;
  if (fillCount !== 0n) throw new Error(`Expected fillCount=0, got ${fillCount}`);
  console.log("  Confirmed: fillCount=0. Callbacks are IntentManager-only.");
  console.log("Done.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
