import { deployToBase } from "../../lib/deploy-lib";

async function main(): Promise<void> {
  const ctx = await deployToBase({ contractName: "ProtocolFeeRecorder" });

  console.log("Reading initial tokenTotalFee(deployer)...");
  const fee = await ctx.publicClient.readContract({
    address: ctx.contractAddress,
    abi: ctx.abi,
    functionName: "tokenTotalFee",
    args: [ctx.account.address],
  } as never) as bigint;
  if (fee !== 0n) throw new Error(`Expected tokenTotalFee=0, got ${fee}`);
  console.log("  Confirmed: tokenTotalFee=0. Callbacks are IntentManager-only.");
  console.log("Done.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
