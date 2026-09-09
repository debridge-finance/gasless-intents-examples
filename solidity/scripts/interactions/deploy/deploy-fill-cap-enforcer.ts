import { deployToBase } from "../../lib/deploy-lib";

async function main(): Promise<void> {
  const ctx = await deployToBase({ contractName: "FillCapEnforcer" });

  console.log("Reading owner()...");
  const owner = await ctx.publicClient.readContract({
    address: ctx.contractAddress,
    abi: ctx.abi,
    functionName: "owner",
  } as never) as string;
  if (String(owner).toLowerCase() !== ctx.account.address.toLowerCase()) {
    throw new Error(`Expected owner=${ctx.account.address}, got ${owner}`);
  }
  console.log(`  Confirmed: owner=${owner}. Callbacks are IntentManager-only.`);
  console.log("Done.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
