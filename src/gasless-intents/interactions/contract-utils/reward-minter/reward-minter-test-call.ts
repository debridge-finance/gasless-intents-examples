/**
 * Direct on-chain test of the deployed RewardMinter: call onPreCall once
 * with reward=1, assert RewardEarned event and rewards mapping.
 */
import { decodeEventLog, encodeAbiParameters, type Hex } from "viem";
import { loadAbi } from "../shared/artefact-loader";
import { requireDeployedAddress } from "../shared/deployed-addresses";
import {
  ZERO_BYTES32,
  firstEventLog,
  getBaseClients,
  readView,
  writeTx,
} from "../shared/base-clients";

const REWARD_PAYLOAD_ABI = [
  { type: "address" },
  { type: "uint256" },
] as const;

async function main(): Promise<void> {
  const address = requireDeployedAddress("RewardMinter");
  const abi = loadAbi("RewardMinter");
  const { account, publicClient, walletClient } = getBaseClients();

  console.log(`RewardMinter: ${address}`);
  const before = await readView<bigint>(publicClient, {
    address,
    abi,
    functionName: "rewards",
    args: [account.address],
  });
  console.log(`  rewards(deployer) before: ${before}`);

  const payload = encodeAbiParameters(REWARD_PAYLOAD_ABI, [account.address, 1n]);
  const hash = await writeTx(walletClient, publicClient, account, {
    address,
    abi,
    functionName: "onPreCall",
    args: [ZERO_BYTES32, ZERO_BYTES32, payload],
  });
  console.log(`  Tx: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error(`onPreCall reverted in tx ${hash}`);
  }
  const log = firstEventLog(receipt.logs);
  const decoded = decodeEventLog({
    abi,
    eventName: "RewardEarned",
    data: log.data,
    topics: log.topics as [signature: Hex, ...args: Hex[]],
  });
  const args = decoded.args as unknown as { reward: bigint; totalRewards: bigint; subject: Hex };
  console.log(
    `  Confirmed: RewardEarned subject=${args.subject} reward=${args.reward} totalRewards=${args.totalRewards}`,
  );
  if (args.totalRewards !== before + 1n) {
    throw new Error(`Expected totalRewards ${before + 1n}, got ${args.totalRewards}`);
  }
  console.log("Done.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
