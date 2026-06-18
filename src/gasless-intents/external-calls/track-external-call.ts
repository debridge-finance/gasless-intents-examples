import "dotenv/config";

import { getBundleById, collectOrderIds } from "@utils/gasless-api";
import { getUrlWithStatus } from "@utils/http";

// ---------------------------------------------------------------------------
// Track an external call: bundleId -> orderId -> externalCallState.
//
// The gasless API returns the bundle and the underlying DLN orderId, but NOT the
// external call's execution state. For that you take the orderId to the DLN order
// endpoint. This matters for any NON-ATOMIC or NON-SUCCESS-REQUIRED hook — and for
// EVERY Solana external call (always non-atomic, staged): a *filled* order does not
// tell you whether the call ran or where the funds ended up (your target vs the
// fallback). Only externalCallState does.
//
// All read-only GETs.
// ---------------------------------------------------------------------------

const BUNDLE_ID = "0x9141f7c235dcc6f496fb461a8ab8b17441c66b9445e0be3b6e529a7b17f9a740"; // replace with your own
const DLN_V1 = "https://dln.debridge.finance/v1.0/dln/order";
const DLN_MONITORING = "https://dln-api.debridge.finance/api/Orders";

async function main() {
  // 1. Resolve the orderId(s) from the bundle (gasless API).
  console.log(`Fetching bundle ${BUNDLE_ID} ...`);
  const bundle = await getBundleById(BUNDLE_ID);
  const orderIds = [...collectOrderIds(bundle)];
  console.log(
    `Resolved orderId(s): ${orderIds.length ? JSON.stringify(orderIds) : "(none — same-chain trades have no DLN order)"}`,
  );

  // 2. For each orderId, read the external-call status from the DLN order endpoint.
  for (const orderId of orderIds) {
    const { status, body } = await getUrlWithStatus(`${DLN_V1}/${orderId}`);
    console.log(`\nGET ${DLN_V1}/${orderId} -> ${status}`);
    console.log(`  OrderStatus:       ${body?.status}`);
    console.log(`  externalCallState: ${body?.externalCallState}`);
    // Interpreting externalCallState:
    //   Completed          -> the call ran at your target
    //   Failed | Cancelled -> funds recovered to the fallback (the order authority)
    //   AwaitingExecution  -> not run yet (normal for staged Solana calls; a fill is NOT proof it ran)
    //   NoExtCall          -> this order carries no external call

    // 3. (optional) step-by-step execution progress
    const proc = await getUrlWithStatus(`${DLN_MONITORING}/${orderId}/externalCallProcess`);
    console.log(`  externalCallProcess -> ${proc.status}`);
  }
}

main().catch((err) => {
  console.error("\n🚨 FATAL ERROR in track-external-call:", err);
  process.exitCode = 1;
});
