import { deployToBase } from "../../lib/deploy-lib";

async function main(): Promise<void> {
  const ctx = await deployToBase({ contractName: "FillCounter" });

  console.log("Reading initial getStats(deployer)...");
  const stats = await ctx.publicClient.readContract({
    address: ctx.contractAddress,
    abi: ctx.abi,
    functionName: "getStats",
    args: [ctx.account.address],
  } as never) as readonly [bigint, bigint];
  const [fills, giveTotal] = stats;
  if (fills !== 0n || giveTotal !== 0n) {
    throw new Error(`Expected zero stats, got fills=${fills} giveTotal=${giveTotal}`);
  }
  console.log("  Confirmed: fills=0 giveTotal=0. Callbacks are IntentManager-only.");
  console.log("Done.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
