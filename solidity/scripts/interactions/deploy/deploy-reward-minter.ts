import { deployToBase } from "../../lib/deploy-lib";

async function main(): Promise<void> {
  const ctx = await deployToBase({ contractName: "RewardMinter" });

  console.log("Reading initial rewards(deployer)...");
  const reward = await ctx.publicClient.readContract({
    address: ctx.contractAddress,
    abi: ctx.abi,
    functionName: "rewards",
    args: [ctx.account.address],
  } as never) as bigint;
  if (reward !== 0n) throw new Error(`Expected reward=0, got ${reward}`);
  console.log("  Confirmed: rewards=0. Callbacks are IntentManager-only.");
  console.log("Done.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
