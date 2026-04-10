/**
 * Example 1 — Same-Token USDC Consolidation with totalDstAmount
 *
 * Consolidate USDC from Arbitrum, Base, and Polygon into exactly 5 USDC
 * on BNB Chain.
 *
 * How it works:
 *   The bundle carries a `totalDstAmount` field — the exact amount of the
 *   destination token the user wants to receive. The system iterates trades
 *   in array order, converting each source into destination USDC on BNB.
 *   Once the cumulative amount (minus operational expenses) reaches the
 *   target, the current trade is trimmed to take only what's needed. That
 *   trade is called the "balancing trade." Any trades after it are ignored.
 *
 * Constraints when totalDstAmount is present:
 *   - All trades must share the same dst token and dst chain.
 *   - enableAccountAbstraction must be true.
 *   - prependOperatingExpenses must be false on every trade.
 *   - srcChainTokenInAmount is an upper bound — the system may take less.
 *
 * NOTE: USDC on BNB Chain has 18 decimals (not 6 like on most other chains).
 *       5 USDC on BNB = 5 * 10^18 = "5000000000000000000".
 *
 * Usage: npx tsx src/gasless-intents/total-dst-amount/usdc-arb-base-poly-to-bnb.ts
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

  // 5 USDC on BNB (18 decimals)
  const totalDstAmount = (5n * 10n ** 18n).toString();

  // ── Trades ─────────────────────────────────────────────────────────
  // All three trades target the same dst token (USDC) and chain (BNB).
  // srcChainTokenInAmount: "max" means "take up to the full wallet balance."
  // dstChainTokenOutAmount: "auto" means "the system calculates how much
  // destination token this source amount converts to."

  const arbUsdcToBnbUsdc: Trade = {
    srcChainId: CHAIN_IDS.Arbitrum,
    srcChainTokenIn: USDC.Arbitrum,            // USDC on Arbitrum, 6 decimals
    srcChainTokenInAmount: TokenAmount.MAX,     // take up to full wallet balance

    dstChainId: CHAIN_IDS.BNB,
    dstChainTokenOut: USDC.BNB,                // USDC on BNB, 18 decimals
    dstChainTokenOutAmount: TokenAmount.AUTO,   // system calculates dst amount
    dstChainTokenOutRecipient: account.address,

    srcChainAuthorityAddress: account.address,
    dstChainAuthorityAddress: account.address,

    prependOperatingExpenses: false,            // required when totalDstAmount is set
  };

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

  // ── Bundle ─────────────────────────────────────────────────────────

  const requestBody: BundleProposeBody = {
    requestId: randomUUID(),
    expirationTimestamp: Math.floor((new Date().getTime() * 2) / 1000),
    enableAccountAbstraction: true,   // required for totalDstAmount
    isAtomic: true,
    tradingAlgorithm: TradingAlgorithm.MARKET,
    trades: [
      arbUsdcToBnbUsdc,   // processed first
      baseUsdcToBnbUsdc,   // processed second
      polyUsdcToBnbUsdc,   // processed third — likely the balancing trade
    ],
    totalDstAmount,        // "I want exactly 5 USDC on BNB"
  };

  // ── Propose ────────────────────────────────────────────────────────
  console.log("Creating bundle with totalDstAmount...");
  console.log(`  totalDstAmount: ${totalDstAmount} (5 USDC, 18 decimals on BNB)`);

  const bundle = await createBundle(requestBody);
  console.log("\nBundle created successfully!");
  console.log(JSON.stringify(bundle, null, 2));

  if (bundle.tokenResult?.length) {
    console.log("\n--- Token Results (actual amounts after balancing) ---");
    for (const tr of bundle.tokenResult) {
      console.log(`  Chain ${tr.chainId}: ${tr.amount} (~$${tr.approximateUsdValue.toFixed(2)})`);
    }
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

  console.log("\nSubmitting bundle...");
  const submitResponse = await submitBundle(submitPayload);
  console.log("Submit response:", submitResponse);
}

main().catch((error) => {
  console.error("\nFATAL ERROR in script execution:", error);
  process.exitCode = 1;
});
