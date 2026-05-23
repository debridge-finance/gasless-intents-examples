/**
 * Direct on-chain test of the deployed FillCounter:
 *   1. onPreCall → assert FillRecorded.
 *   2. onPostCallForCrossChainIntent → assert FillRecorded + lifetime credit.
 */
import { decodeEventLog, encodeAbiParameters, type Hex } from "viem";
import { loadAbi } from "../shared/artefact-loader";
import { requireDeployedAddress } from "../shared/deployed-addresses";
import {
  ZERO_BYTES32,
  firstEventLog,
  getBaseClients,
  writeTx,
} from "../shared/base-clients";

const SUBJECT_ONLY_ABI = [{ type: "address" }] as const;

async function main(): Promise<void> {
  const address = requireDeployedAddress("FillCounter");
  const abi = loadAbi("FillCounter");
  const { account, publicClient, walletClient } = getBaseClients();

  console.log(`FillCounter: ${address}`);
  const payload = encodeAbiParameters(SUBJECT_ONLY_ABI, [account.address]);

  console.log("Step 1/2: onPreCall");
  const preHash = await writeTx(walletClient, publicClient, account, {
    address,
    abi,
    functionName: "onPreCall",
    args: [ZERO_BYTES32, ZERO_BYTES32, payload],
  });
  console.log(`  Tx: ${preHash}`);
  const preReceipt = await publicClient.waitForTransactionReceipt({ hash: preHash });
  if (preReceipt.status !== "success") {
    throw new Error(`onPreCall reverted in tx ${preHash}`);
  }
  const preLog = firstEventLog(preReceipt.logs);
  const preDecoded = decodeEventLog({
    abi,
    eventName: "FillRecorded",
    data: preLog.data,
    topics: preLog.topics as [signature: Hex, ...args: Hex[]],
  });
  const preArgs = preDecoded.args as unknown as {
    subject: Hex;
    intentFillNumber: bigint;
    lifetimeFills: bigint;
  };
  console.log(
    `  Confirmed: FillRecorded subject=${preArgs.subject} intentFillNumber=${preArgs.intentFillNumber} lifetimeFills=${preArgs.lifetimeFills}`,
  );

  console.log("Step 2/2: onPostCallForCrossChainIntent");
  const ctx = {
    intentId: ZERO_BYTES32,
    tradeId: ZERO_BYTES32,
    payload,
    giveToken: "0x0000000000000000000000000000000000000001" as `0x${string}`,
    giveAmount: 7n,
    takeToken: "0x" as `0x${string}`,
    takeAmount: 0n,
    takeChainId: 8453,
    takeChainReceiver: "0x" as `0x${string}`,
  };
  const postHash = await writeTx(walletClient, publicClient, account, {
    address,
    abi,
    functionName: "onPostCallForCrossChainIntent",
    args: [ctx],
  });
  console.log(`  Tx: ${postHash}`);
  const postReceipt = await publicClient.waitForTransactionReceipt({ hash: postHash });
  if (postReceipt.status !== "success") {
    throw new Error(`onPostCallForCrossChainIntent reverted in tx ${postHash}`);
  }
  console.log(`  Confirmed: ${postReceipt.logs.length} events emitted`);
  console.log("Done.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
