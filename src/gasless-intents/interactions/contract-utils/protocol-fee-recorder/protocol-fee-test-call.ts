/**
 * Direct on-chain test of the deployed ProtocolFeeRecorder. Only the
 * same-chain-with-preswap variant is exercised — cross-chain variants
 * revert by design.
 *
 * Calls onPostCallForSameChainIntentWithPreSwap with a 2-leg preSwap totalling
 * 1000 and takeAmountAfterFeeCharge=970 → expected fee=30, bps=300.
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
const TAKE_TOKEN = "0x0000000000000000000000000000000000000001" as `0x${string}`;

async function main(): Promise<void> {
  const address = requireDeployedAddress("ProtocolFeeRecorder");
  const abi = loadAbi("ProtocolFeeRecorder");
  const { account, publicClient, walletClient } = getBaseClients();

  console.log(`ProtocolFeeRecorder: ${address}`);

  const ctx = {
    intentId: ZERO_BYTES32,
    tradeId: ZERO_BYTES32,
    payload: encodeAbiParameters(SUBJECT_ONLY_ABI, [account.address]),
    preSwapResults: [
      { inputToken: "0x0000000000000000000000000000000000000002" as `0x${string}`, inputAmount: 100n, outputAmount: 600n },
      { inputToken: "0x0000000000000000000000000000000000000003" as `0x${string}`, inputAmount: 200n, outputAmount: 400n },
    ],
    takeToken: TAKE_TOKEN,
    takeAmountAfterFeeCharge: 970n,
    receiver: account.address,
  };

  console.log("Calling onPostCallForSameChainIntentWithPreSwap (expect fee=30, bps=300)");
  const hash = await writeTx(walletClient, publicClient, account, {
    address,
    abi,
    functionName: "onPostCallForSameChainIntentWithPreSwap",
    args: [ctx],
  });
  console.log(`  Tx: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error(`reverted in tx ${hash}`);
  }
  const log = firstEventLog(receipt.logs);
  const decoded = decodeEventLog({
    abi,
    eventName: "ProtocolFeeRecorded",
    data: log.data,
    topics: log.topics as [signature: Hex, ...args: Hex[]],
  });
  const args = decoded.args as unknown as { feeAmount: bigint; feeBps: bigint; takeToken: Hex };
  if (args.feeAmount !== 30n || args.feeBps !== 300n) {
    throw new Error(
      `Expected feeAmount=30 feeBps=300, got ${args.feeAmount}/${args.feeBps}`,
    );
  }
  console.log(`  Confirmed: ProtocolFeeRecorded feeAmount=${args.feeAmount} feeBps=${args.feeBps}`);
  console.log("Done.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
