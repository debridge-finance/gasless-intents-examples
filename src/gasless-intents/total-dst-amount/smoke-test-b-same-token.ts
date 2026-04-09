/**
 * Smoke Test B — Same-Token Consolidation with Trimming
 *
 * Scenario: 2.5 USDC on Base + 5 USDC on Arbitrum → 5 USDC on BNB Chain.
 *
 * The combined source (7.5 USDC) exceeds the 5 USDC target. The system
 * iterates trades in array order. Trade 1 contributes ~2.5 USDC. Trade 2
 * offers 5 USDC, but the system trims it to only take ~2.5 USDC — just
 * enough to reach the totalDstAmount target. Trade 2 is the "balancing trade."
 *
 * What to verify:
 *   - Total received on BNB ≈ 5 USDC (not 7.5 USDC).
 *   - Trade 2 is trimmed: srcAmount taken < 5 USDC offered.
 *   - The tokenResult shows the actual (trimmed) amounts.
 *
 * Prerequisites:
 *   - Fund wallet with ≥ 2.5 USDC on Base
 *   - Fund wallet with ≥ 5 USDC on Arbitrum
 *   - Set SIGNER_PK and DE_BRIDGE_PARTNER_API_KEY in .env
 *
 * Usage: npx tsx src/gasless-intents/total-dst-amount/smoke-test-b-same-token.ts
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
import { Bundle, BundleProposeBody, Trade, TradingAlgorithm } from "../types";

async function main() {
  const { privateKey } = getEnvConfig();
  const account = privateKeyToAccount(`0x${clipHexPrefix(privateKey)}`);
  const chainIdToWalletClientMap = getChainIdToWalletClientMap(account);

  // USDC on BNB Chain has 18 decimals.
  const totalDstAmount = (5n * 10n ** 18n).toString(); // 5 USDC

  // Trade 1: 2.5 USDC on Base → USDC on BNB
  const baseUsdcToBnbUsdc: Trade = {
    srcChainId: CHAIN_IDS.Base,
    srcChainTokenIn: USDC.Base,
    srcChainTokenInAmount: "2500000",  // 2.5 USDC (6 decimals)

    dstChainId: CHAIN_IDS.BNB,
    dstChainTokenOut: USDC.BNB,
    dstChainTokenOutAmount: "auto",
    dstChainTokenOutRecipient: account.address,

    srcChainAuthorityAddress: account.address,
    dstChainAuthorityAddress: account.address,

    prependOperatingExpenses: false,
  };

  // Trade 2: 5 USDC on Arbitrum → USDC on BNB
  // This trade offers more than needed. The system will trim it to only take
  // enough to reach totalDstAmount. This is the expected balancing trade.
  const arbUsdcToBnbUsdc: Trade = {
    srcChainId: CHAIN_IDS.Arbitrum,
    srcChainTokenIn: USDC.Arbitrum,
    srcChainTokenInAmount: "5000000",  // 5 USDC (6 decimals) — more than needed

    dstChainId: CHAIN_IDS.BNB,
    dstChainTokenOut: USDC.BNB,
    dstChainTokenOutAmount: "auto",
    dstChainTokenOutRecipient: account.address,

    srcChainAuthorityAddress: account.address,
    dstChainAuthorityAddress: account.address,

    prependOperatingExpenses: false,
  };

  // Both trades target USDC on BNB — same dst token and chain.
  // Combined source = 7.5 USDC, but totalDstAmount = 5 USDC.
  // The system trims Trade 2 to only take what's needed.
  const requestBody: BundleProposeBody = {
    requestId: randomUUID(),
    expirationTimestamp: Math.floor((new Date().getTime() * 2) / 1000),
    enableAccountAbstraction: true,
    isAtomic: true,
    tradingAlgorithm: TradingAlgorithm.MARKET,
    trades: [
      baseUsdcToBnbUsdc,   // Trade 1: 2.5 USDC from Base
      arbUsdcToBnbUsdc,    // Trade 2: 5 USDC from Arb (will be trimmed)
    ],
    totalDstAmount,         // 5 USDC on BNB (18 decimals)
  };

  // ── Propose ────────────────────────────────────────────────────────
  console.log("Creating bundle with totalDstAmount (same-token trimming test)...");
  console.log(`  totalDstAmount: ${totalDstAmount} (5 USDC, 18 decimals on BNB)`);
  console.log(`  Trade 1: 2.5 USDC on Base`);
  console.log(`  Trade 2: 5.0 USDC on Arbitrum (expect trimming)`);
  console.log(`  Combined source: 7.5 USDC -> target: 5 USDC`);

  const bundle = await createBundle(requestBody);

  console.log("\nBundle created successfully!");
  console.log(JSON.stringify(bundle, null, 2));

  // Token results — the key output for this test.
  // Trade 2 should show a reduced amount (not the full 5 USDC).
  if (bundle.tokenResult && bundle.tokenResult.length > 0) {
    console.log("\n--- Token Results (actual amounts after balancing) ---");
    for (const tr of bundle.tokenResult) {
      console.log(
        `  Chain ${tr.chainId}: ${tr.amount} (~$${tr.approximateUsdValue.toFixed(2)}) -> ${tr.recipientAddress}`,
      );
    }
    console.log("\nExpected: Trade 2 amount should be < 5 USDC (it was trimmed).");
  }

  if (bundle.intents && bundle.intents.length > 0) {
    console.log(
      "\nFirst intent:",
      util.inspect(bundle.intents[0], { showHidden: false, depth: null, colors: true }),
    );
  }

  // ── Sign ───────────────────────────────────────────────────────────
  console.log("\nCollecting signatures for all intents...");
  const signedDataArray = await processIntentBundle(bundle, chainIdToWalletClientMap);
  console.log(`Generated ${signedDataArray.length} signatures for ${bundle.intents?.length ?? 0} intents`);

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
