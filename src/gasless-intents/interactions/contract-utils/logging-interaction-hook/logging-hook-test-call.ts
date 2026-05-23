/**
 * Direct on-chain test of the deployed LoggingInteractionHook:
 *   1. onPreCall with a synthetic payload → assert PreCallLogged event.
 *   2. onPostCallForSameChainIntentWithPreSwap with a synthetic context →
 *      assert PostCallSameChainLogged event.
 *
 * Cross-chain post-call variants are skipped here because they require
 * abi-encoding `bytes` token / receiver values; the propose-side examples in
 * `interactions/cross-chain-*.ts` cover the wire format.
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

const LOG_PAYLOAD_ABI = [
  { type: "string" },
  { type: "address" },
  { type: "uint256" },
] as const;

async function main(): Promise<void> {
  const address = requireDeployedAddress("LoggingInteractionHook");
  const abi = loadAbi("LoggingInteractionHook");
  const { account, publicClient, walletClient } = getBaseClients();

  console.log(`LoggingInteractionHook: ${address}`);
  const payload = encodeAbiParameters(LOG_PAYLOAD_ABI, [
    "test-call",
    account.address,
    0n,
  ]);

  console.log("Step 1/2: onPreCall (expect PreCallLogged)");
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
    eventName: "PreCallLogged",
    data: preLog.data,
    topics: preLog.topics as [signature: Hex, ...args: Hex[]],
  });
  const preArgs = preDecoded.args as unknown as { subject: Hex; fillNumber: bigint };
  console.log(`  Confirmed: PreCallLogged subject=${preArgs.subject} fillNumber=${preArgs.fillNumber}`);

  console.log("Step 2/2: onPostCallForSameChainIntentWithPreSwap (expect PostCallSameChainLogged)");
  const ctx = {
    intentId: ZERO_BYTES32,
    tradeId: ZERO_BYTES32,
    payload,
    preSwapResults: [],
    takeToken: "0x0000000000000000000000000000000000000001" as `0x${string}`,
    takeAmountAfterFeeCharge: 0n,
    receiver: account.address,
  };
  const postHash = await writeTx(walletClient, publicClient, account, {
    address,
    abi,
    functionName: "onPostCallForSameChainIntentWithPreSwap",
    args: [ctx],
  });
  console.log(`  Tx: ${postHash}`);
  const postReceipt = await publicClient.waitForTransactionReceipt({ hash: postHash });
  if (postReceipt.status !== "success") {
    throw new Error(`onPostCallForSameChainIntentWithPreSwap reverted in tx ${postHash}`);
  }
  console.log(`  Confirmed: ${postReceipt.logs.length} events emitted`);
  console.log("Done.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
