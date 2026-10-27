import { deployToBase, ZERO_BYTES32 } from "../../lib/deploy-lib";

async function main(): Promise<void> {
  const ctx = await deployToBase({ contractName: "IntentSubmitter" });

  console.log("Reading owner() / RECIPIENT() sanity checks...");
  const owner = (await ctx.publicClient.readContract({
    address: ctx.contractAddress,
    abi: ctx.abi,
    functionName: "owner",
  } as never)) as string;
  if (owner.toLowerCase() !== ctx.account.address.toLowerCase()) {
    throw new Error(`owner() is ${owner}, expected deployer ${ctx.account.address}`);
  }
  const recipient = (await ctx.publicClient.readContract({
    address: ctx.contractAddress,
    abi: ctx.abi,
    functionName: "RECIPIENT",
  } as never)) as string;
  const submitted = (await ctx.publicClient.readContract({
    address: ctx.contractAddress,
    abi: ctx.abi,
    functionName: "isIntentSubmitted",
    args: [ZERO_BYTES32],
  } as never)) as boolean;
  if (submitted) throw new Error("isIntentSubmitted(0x0) returned true on a fresh deploy");

  console.log(`  owner     = ${owner} (deployer)`);
  console.log(`  RECIPIENT = ${recipient}`);
  console.log("  isIntentSubmitted(0x0) = false");
  console.log("Done.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
