import "dotenv/config";

import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";

import { SOLANA_RPC_URL } from "@utils/constants";
import { getEnvConfig } from "@utils/env";
import { getUrlWithStatus } from "@utils/http";
import { simulateAndSendTx } from "@utils/solana";

// ---------------------------------------------------------------------------
// Cancel a pending Solana external call (hook) attached to a DLN order.
//
// Flow (all real, state-changing — submits ONE Solana tx):
//   1. read order status -> confirm the extcall is still cancellable
//   2. GET extcall-cancel-tx (fresh) -> { data, from, chainId, cancelBeneficiary }
//   3. HARD GATE: our SOL_PK wallet must equal `from` (the allowed canceller)
//   4. simulateAndSendTx -> refresh blockhash, single-signer gate, sign, SIMULATE (abort on error), send
//   5. re-read order status -> show the externalCallState change
// ---------------------------------------------------------------------------

const ORDER_ID = "0xb8689ee559cd754a835efbb0981f4f103defc8a9bed4257a1fefa29f5cf4c12c";
const DLN_V1 = "https://dln.debridge.finance/v1.0/dln/order";

async function readStatus(label: string): Promise<any> {
  const { status, body } = await getUrlWithStatus(`${DLN_V1}/${ORDER_ID}`);
  console.log(`\n[${label}] GET ${DLN_V1}/${ORDER_ID} -> ${status}`);
  console.log(`  status: ${body?.status}   externalCallState: ${body?.externalCallState}`);
  return body;
}

async function main() {
  const { solPrivateKey } = getEnvConfig();
  if (!solPrivateKey) throw new Error("Missing SOL_PK in .env");
  const wallet = Keypair.fromSecretKey(bs58.decode(solPrivateKey));
  const me = wallet.publicKey.toBase58();
  console.log(`Solana wallet (from SOL_PK): ${me}`);

  // 1. confirm still cancellable
  const before = await readStatus("status-before");
  const cancellableStates = ["AwaitingOrderFulfillment", "AwaitingExecution"];
  if (!cancellableStates.includes(before?.externalCallState)) {
    console.log(
      `\nAborting: externalCallState=${before?.externalCallState} is not in cancellable set ${JSON.stringify(
        cancellableStates,
      )}. Nothing to do.`,
    );
    return;
  }

  // 2. fresh extcall-cancel-tx
  const { status: ccStatus, body: cancelTx } = await getUrlWithStatus(`${DLN_V1}/${ORDER_ID}/extcall-cancel-tx`);
  console.log(`\nGET ${DLN_V1}/${ORDER_ID}/extcall-cancel-tx -> ${ccStatus}`);
  if (ccStatus !== 200) {
    console.log(`  Endpoint did not return a tx: ${JSON.stringify(cancelTx)}`);
    console.log("Aborting: no cancel tx to submit.");
    return;
  }
  console.log(`  chainId=${cancelTx.chainId} from=${cancelTx.from} cancelBeneficiary=${cancelTx.cancelBeneficiary}`);

  // 3. HARD GATE — we must be the allowed canceller
  if (cancelTx.from !== me) {
    console.log(
      `\nAborting: cancel tx requires sender ${cancelTx.from}, but SOL_PK wallet is ${me}. ` +
        "We are not the order's destination authority — cannot sign this cancellation.",
    );
    return;
  }

  // 4. sign + simulate + send (shared helper: single-signer gate, blockhash refresh, simulate-abort)
  const result = await simulateAndSendTx(SOLANA_RPC_URL, cancelTx.data, wallet);
  if (!result.ok) {
    console.log(`\nAborting: ${result.reason}`);
    return;
  }
  console.log(`\n  Submitted: ${result.signature}`);
  console.log(`  Explorer: https://solscan.io/tx/${result.signature}`);

  // 5. re-read status
  await readStatus("status-after");
  console.log("\nDone.");
}

main().catch((err) => {
  console.error("\nFATAL ERROR in cancel-extcall-solana:", err);
  process.exitCode = 1;
});
