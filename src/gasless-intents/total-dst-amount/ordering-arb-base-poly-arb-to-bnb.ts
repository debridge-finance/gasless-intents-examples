/**
 * Example 5 — Trade Ordering, Balancing on Polygon
 *
 * Four trades from Arbitrum, Base, Polygon, Arbitrum (in that order) →
 * 6 USDC on BNB Chain. The balancing trade lands on Polygon (3rd in array),
 * so the 4th trade (Arbitrum again) is never executed.
 *
 * Key points:
 *   - Trade array order = iteration order. The system processes trades
 *     sequentially and stops as soon as the target is reached.
 *   - A source chain can appear more than once (Arbitrum at positions 1 and 4).
 *   - Constraint: two trades from the same token + chain cannot BOTH use
 *     srcAmount: "max". That's why both Arbitrum trades use specific amounts.
 *   - Trades after the balancing trade are ignored entirely.
 *
 * Usage: npx tsx src/gasless-intents/total-dst-amount/ordering-arb-base-poly-arb-to-bnb.ts
 */

import { privateKeyToAccount } from "viem/accounts";
import { randomUUID } from "crypto";
import util from "util";

import { clipHexPrefix, getEnvConfig } from "@utils/index";
import { createBundle, submitBundle } from "@utils/api";
import { processIntentBundle } from "@utils/signatures/intent-signatures";
import { getChainIdToWalletClientMap } from "@utils/wallet";
import { CHAIN_IDS } from "@utils/chains";
import { USDC } from "@utils/constants";
import { Bundle, BundleProposeBody, Trade, TradingAlgorithm, TokenAmount } from "../types";

async function main() {
  const { privateKey } = getEnvConfig();
  const account = privateKeyToAccount(`0x${clipHexPrefix(privateKey)}`);
  const chainIdToWalletClientMap = getChainIdToWalletClientMap(account);

  // 6 USDC on BNB (18 decimals)
  const totalDstAmount = (6n * 10n ** 18n).toString();

  // ── Trades ─────────────────────────────────────────────────────────

  // Trade 1: 2 USDC on Arbitrum → USDC on BNB (specific amount, not max)
  // Cannot use "max" because Trade 4 is also Arbitrum USDC.
  const arbUsdc1ToBnbUsdc: Trade = {
    srcChainId: CHAIN_IDS.Arbitrum,
    srcChainTokenIn: USDC.Arbitrum,
    srcChainTokenInAmount: "2000000",          // 2 USDC (6 decimals) — specific, not max

    dstChainId: CHAIN_IDS.BNB,
    dstChainTokenOut: USDC.BNB,
    dstChainTokenOutAmount: TokenAmount.AUTO,
    dstChainTokenOutRecipient: account.address,

    srcChainAuthorityAddress: account.address,
    dstChainAuthorityAddress: account.address,

    prependOperatingExpenses: false,
  };

  // Trade 2: USDC on Base → USDC on BNB (max)
  const baseUsdcToBnbUsdc: Trade = {
    srcChainId: CHAIN_IDS.Base,
    srcChainTokenIn: USDC.Base,
    srcChainTokenInAmount: TokenAmount.MAX,

    dstChainId: CHAIN_IDS.BNB,
    dstChainTokenOut: USDC.BNB,
    dstChainTokenOutAmount: TokenAmount.AUTO,
    dstChainTokenOutRecipient: account.address,

    srcChainAuthorityAddress: account.address,
    dstChainAuthorityAddress: account.address,

    prependOperatingExpenses: false,
  };

  // Trade 3: USDC on Polygon → USDC on BNB (max)
  // This should be the balancing trade — trimmed to cover the remaining amount.
  const polyUsdcToBnbUsdc: Trade = {
    srcChainId: CHAIN_IDS.Polygon,
    srcChainTokenIn: USDC.Polygon,
    srcChainTokenInAmount: TokenAmount.MAX,

    dstChainId: CHAIN_IDS.BNB,
    dstChainTokenOut: USDC.BNB,
    dstChainTokenOutAmount: TokenAmount.AUTO,
    dstChainTokenOutRecipient: account.address,

    srcChainAuthorityAddress: account.address,
    dstChainAuthorityAddress: account.address,

    prependOperatingExpenses: false,
  };

  // Trade 4: 2 USDC on Arbitrum → USDC on BNB (specific amount)
  // This trade should NEVER execute — the target is already reached by Trade 3.
  const arbUsdc2ToBnbUsdc: Trade = {
    srcChainId: CHAIN_IDS.Arbitrum,
    srcChainTokenIn: USDC.Arbitrum,
    srcChainTokenInAmount: "2000000",          // 2 USDC — never taken

    dstChainId: CHAIN_IDS.BNB,
    dstChainTokenOut: USDC.BNB,
    dstChainTokenOutAmount: TokenAmount.AUTO,
    dstChainTokenOutRecipient: account.address,

    srcChainAuthorityAddress: account.address,
    dstChainAuthorityAddress: account.address,

    prependOperatingExpenses: false,
  };

  // ── Bundle ─────────────────────────────────────────────────────────

  const requestBody: BundleProposeBody = {
    requestId: randomUUID(),
    expirationTimestamp: Math.floor((new Date().getTime() * 2) / 1000),
    enableAccountAbstraction: true,
    isAtomic: true,
    tradingAlgorithm: TradingAlgorithm.MARKET,
    trades: [
      arbUsdc1ToBnbUsdc,    // 1: Arb, 2 USDC specific
      baseUsdcToBnbUsdc,    // 2: Base, max
      polyUsdcToBnbUsdc,    // 3: Polygon, max — expected balancing trade
      arbUsdc2ToBnbUsdc,    // 4: Arb again, 2 USDC — should be skipped
    ],
    totalDstAmount,
  };

  // ── Propose ────────────────────────────────────────────────────────
  console.log("Creating bundle (trade ordering test → 6 USDC on BNB)...");
  console.log(`  totalDstAmount: ${totalDstAmount}`);
  console.log(`  4 trades: Arb(2) → Base(max) → Poly(max, balancing) → Arb(2, skipped)`);

  const bundle = await createBundle(requestBody);
  console.log("\nBundle created!");
  console.log(JSON.stringify(bundle, null, 2));

  if (bundle.tokenResult?.length) {
    console.log("\n--- Token Results ---");
    for (const tr of bundle.tokenResult) {
      console.log(`  Chain ${tr.chainId}: ${tr.amount} (~$${tr.approximateUsdValue.toFixed(2)})`);
    }
    console.log("\nExpected: Trade 4 should not appear or show zero amount.");
  }

  if (bundle.intents?.length) {
    console.log("\nFirst intent:", util.inspect(bundle.intents[0], { depth: null, colors: true }));
  }

  // ── Sign ───────────────────────────────────────────────────────────
  console.log("\nCollecting signatures...");
  const signedDataArray = await processIntentBundle(bundle, chainIdToWalletClientMap);
  console.log(`Generated ${signedDataArray.length} signatures`);

  // ── Submit ─────────────────────────────────────────────────────────
  const submitPayload: Bundle = {
    ...bundle,
    requestId: requestBody.requestId,
    enableAccountAbstraction: true,
    isAtomic: true,
    signedData: signedDataArray,
  };

  console.log("\nSubmitting...");
  const submitResponse = await submitBundle(submitPayload);
  console.log("Submit response:", submitResponse);
}

main().catch((error) => {
  console.error("\nFATAL ERROR in script execution:", error);
  process.exitCode = 1;
});
