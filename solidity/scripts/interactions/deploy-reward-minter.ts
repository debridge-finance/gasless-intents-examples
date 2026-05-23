import { encodeAbiParameters, decodeEventLog, type Hex } from "viem";
import { base } from "viem/chains";
import { deployToBase, ZERO_BYTES32 } from "../lib/deploy-lib";

const REWARD_PAYLOAD_ABI = [
  { type: "address" },
  { type: "uint256" },
] as const;

async function main(): Promise<void> {
  const ctx = await deployToBase({ contractName: "RewardMinter" });

  console.log("Sending sanity-check onPreCall()...");
  const payload = encodeAbiParameters(REWARD_PAYLOAD_ABI, [ctx.account.address, 1n]);

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
    throw new Error("No logs in receipt — RewardEarned not emitted");
  }
  const decoded = decodeEventLog({
    abi: ctx.abi,
    eventName: "RewardEarned",
    data: receipt.logs[0].data,
    topics: receipt.logs[0].topics,
  });
  const args = decoded.args as { subject: Hex; reward: bigint; totalRewards: bigint };
  if (args.subject.toLowerCase() !== ctx.account.address.toLowerCase()) {
    throw new Error(`Event subject ${args.subject} != deployer ${ctx.account.address}`);
  }
  if (args.reward !== 1n || args.totalRewards !== 1n) {
    throw new Error(`Expected reward=1 totalRewards=1, got ${args.reward}/${args.totalRewards}`);
  }
  console.log(
    `  Confirmed: RewardEarned subject=${args.subject} reward=${args.reward} totalRewards=${args.totalRewards}`,
  );
  console.log("Done.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
