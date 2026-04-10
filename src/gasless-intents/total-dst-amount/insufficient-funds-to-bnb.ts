/**
 * Example 6 — Insufficient Funds (Error Case)
 *
 * Intentionally underfunded bundle: 2 USDC total across two trades,
 * but totalDstAmount requests 1,000,000 USDC on BNB Chain.
 *
 * The API rejects the bundle because the combined source amount cannot
 * cover the target. This example demonstrates how to handle the
 * "Insufficient funds" error in production.
 *
 * This script does NOT proceed to signing or submission — it only calls
 * createBundle and logs the error.
 *
 * Usage: npx tsx src/gasless-intents/total-dst-amount/insufficient-funds-to-bnb.ts
 */

import { privateKeyToAccount } from "viem/accounts";
import { randomUUID } from "crypto";

import { clipHexPrefix, getEnvConfig } from "@utils/index";
import { createBundle } from "@utils/api";
import { CHAIN_IDS } from "@utils/chains";
import { USDC } from "@utils/constants";
import { BundleProposeBody, Trade, TradingAlgorithm } from "../types";

async function main() {
  const { privateKey } = getEnvConfig();
  const account = privateKeyToAccount(`0x${clipHexPrefix(privateKey)}`);

  // 1,000,000 USDC on BNB (18 decimals) — impossibly high
  const totalDstAmount = (1_000_000n * 10n ** 18n).toString();

  // ── Trades — intentionally underfunded ─────────────────────────────

  // Trade 1: 1 USDC on Base → USDC on BNB
  const baseUsdcToBnbUsdc: Trade = {
    srcChainId: CHAIN_IDS.Base,
    srcChainTokenIn: USDC.Base,
    srcChainTokenInAmount: "1000000",          // 1 USDC (6 decimals)

    dstChainId: CHAIN_IDS.BNB,
    dstChainTokenOut: USDC.BNB,
    dstChainTokenOutAmount: "auto",
    dstChainTokenOutRecipient: account.address,

    srcChainAuthorityAddress: account.address,
    dstChainAuthorityAddress: account.address,

    prependOperatingExpenses: false,
  };

  // Trade 2: 1 USDC on Polygon → USDC on BNB
  const polyUsdcToBnbUsdc: Trade = {
    srcChainId: CHAIN_IDS.Polygon,
    srcChainTokenIn: USDC.Polygon,
    srcChainTokenInAmount: "1000000",          // 1 USDC (6 decimals)

    dstChainId: CHAIN_IDS.BNB,
    dstChainTokenOut: USDC.BNB,
    dstChainTokenOutAmount: "auto",
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
      baseUsdcToBnbUsdc,    // 1 USDC
      polyUsdcToBnbUsdc,    // 1 USDC
    ],
    totalDstAmount,          // 1,000,000 USDC — impossible with 2 USDC total
  };

  // ── Propose (expect failure) ───────────────────────────────────────
  console.log("Creating intentionally underfunded bundle...");
  console.log(`  totalDstAmount: ${totalDstAmount} (1,000,000 USDC)`);
  console.log(`  Total source: 2 USDC (Base + Polygon)`);
  console.log(`  Expected: API rejection with "Insufficient funds"\n`);

  try {
    const bundle = await createBundle(requestBody);
    // If we get here, the API didn't reject — unexpected
    console.log("Unexpected success — bundle was created:");
    console.log(JSON.stringify(bundle, null, 2));
  } catch (error) {
    // Expected path: the API rejects the bundle
    console.log("=== API rejected the bundle (expected) ===\n");

    if (error instanceof Error) {
      console.log("Error message:", error.message);
    } else {
      console.log("Error:", error);
    }

    console.log("\nThis is the expected behavior when totalDstAmount exceeds");
    console.log("what the combined trades can provide. In production, handle");
    console.log("this error by either:");
    console.log("  1. Adding more trades / source chains");
    console.log("  2. Increasing srcChainTokenInAmount on existing trades");
    console.log("  3. Reducing totalDstAmount to match available funds");
  }
}

main().catch((error) => {
  console.error("\nFATAL ERROR in script execution:", error);
  process.exitCode = 1;
});
