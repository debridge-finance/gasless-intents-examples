import { deployToBase } from "../../lib/deploy-lib";

async function main(): Promise<void> {
  const ctx = await deployToBase({ contractName: "AllowlistGuard" });

  console.log("Reading owner() and DOMAIN_SEPARATOR()...");
  const owner = await ctx.publicClient.readContract({
    address: ctx.contractAddress,
    abi: ctx.abi,
    functionName: "owner",
  } as never) as string;
  const domainSeparator = await ctx.publicClient.readContract({
    address: ctx.contractAddress,
    abi: ctx.abi,
    functionName: "DOMAIN_SEPARATOR",
  } as never) as string;
  if (String(owner).toLowerCase() !== ctx.account.address.toLowerCase()) {
    throw new Error(`Expected owner=${ctx.account.address}, got ${owner}`);
  }
  console.log(`  Confirmed: owner=${owner}`);
  console.log(`  DOMAIN_SEPARATOR: ${domainSeparator}`);
  console.log("  Callbacks are IntentManager-only; EIP-712 payload behavior is covered by Foundry tests.");
  console.log("Done.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
