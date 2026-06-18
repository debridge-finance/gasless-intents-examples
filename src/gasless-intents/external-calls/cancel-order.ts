import "dotenv/config";

import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";

import { SOLANA_RPC_URL } from "@utils/constants";
import { getEnvConfig } from "@utils/env";
import { getUrlWithStatus } from "@utils/http";
import { simulateAndSendTx } from "@utils/solana";

// ---------------------------------------------------------------------------
// Cancel a DLN order — refund the still-unfilled input back to the source chain.
//
// Works only while the order is UNFILLED. Once it is Fulfilled the endpoint returns
// ORDER_ALREADY_FULFILLED — at that point only the external call can be detached
// (see cancel-extcall-solana.ts). The cancel-tx is network-agnostic: it returns a
// transaction on the trade's DESTINATION chain, signed by the destination authority
// (orderAuthorityAddressDst); the refund lands with the source cancel beneficiary.
//
// This example signs the SOLANA case (the destination chain for the sample
// Polygon->Solana order). For an EVM-destination order it prints the tx and stops —
// sign and send { to, data, value } with your own EVM wallet for that chain.
//
// Flow:
//   1. read order status (informational)
//   2. GET cancel-tx — a non-200 means it can't be cancelled (e.g. already fulfilled)
//   3. HARD GATE: our SOL_PK wallet must equal `from` (the destination authority)
//   4. simulateAndSendTx -> refresh blockhash, single-signer gate, sign, SIMULATE (abort on error), send
//   5. re-read status
// ---------------------------------------------------------------------------

const ORDER_ID = "0x324ad042d5019a76a4c105c40ec59671fd5860355f0b793d96997832b648a544"; // replace with your OWN unfilled order
const DLN_V1 = "https://dln.debridge.finance/v1.0/dln/order";
const SOLANA_CHAIN_ID = 7565164;

async function main() {
  const { solPrivateKey } = getEnvConfig();
  if (!solPrivateKey) throw new Error("Missing SOL_PK in .env");
  const wallet = Keypair.fromSecretKey(bs58.decode(solPrivateKey));
  const me = wallet.publicKey.toBase58();
  console.log(`Solana wallet (from SOL_PK): ${me}`);

  // 1. read status (informational)
  const { status: sStatus, body: order } = await getUrlWithStatus(`${DLN_V1}/${ORDER_ID}`);
  console.log(`\nGET ${DLN_V1}/${ORDER_ID} -> ${sStatus}`);
  console.log(`  status: ${order?.status}   externalCallState: ${order?.externalCallState}`);

  // 2. GET cancel-tx — non-200 means not cancellable (e.g. ORDER_ALREADY_FULFILLED / UNKNOWN_ORDER)
  const { status: cStatus, body: cancelTx } = await getUrlWithStatus(`${DLN_V1}/${ORDER_ID}/cancel-tx`);
  console.log(`\nGET ${DLN_V1}/${ORDER_ID}/cancel-tx -> ${cStatus}`);
  if (cStatus !== 200) {
    console.log(`  Not cancellable: ${JSON.stringify(cancelTx)}`);
    console.log("Aborting.");
    return;
  }
  console.log(
    `  chainId=${cancelTx.chainId} from=${cancelTx.from} cancelBeneficiary=${cancelTx.cancelBeneficiary} to=${cancelTx.to} value=${cancelTx.value}`,
  );

  // EVM-destination order: this example only signs Solana — print and stop.
  if (cancelTx.chainId !== SOLANA_CHAIN_ID) {
    console.log(
      `\nThis cancel tx is on EVM chain ${cancelTx.chainId}. Sign and send { to, data, value } with your EVM wallet ` +
        "for that chain (this example signs the Solana case only).",
    );
    return;
  }

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
  const { body: after } = await getUrlWithStatus(`${DLN_V1}/${ORDER_ID}`);
  console.log(`\n[after] status: ${after?.status}   externalCallState: ${after?.externalCallState}`);
  console.log("\nDone.");
}

main().catch((err) => {
  console.error("\nFATAL ERROR in cancel-order:", err);
  process.exitCode = 1;
});
