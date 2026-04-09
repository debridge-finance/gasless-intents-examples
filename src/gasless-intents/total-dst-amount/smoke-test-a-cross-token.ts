/**
 * Smoke Test A — Cross-Token Consolidation with totalDstAmount
 *
 * Scenario: 2.5 USDC on Base + 0.003 ETH on Arbitrum → 5 USDC on BNB Chain.
 *
 * The bundle uses `totalDstAmount` to request exactly 5 USDC (in 18-decimal
 * BNB USDC) as the consolidated destination amount. The system iterates the
 * trades in array order, converting each source token to the destination USDC,
 * and trims whichever trade pushes the cumulative total past the target (the
 * "balancing trade").
 *
 * What to verify:
 *   - Final amount received on BNB ≈ 5 USDC, not the raw sum of both trades.
 *   - One of the two trades is trimmed (the balancing trade).
 *
 * Prerequisites:
 *   - Fund wallet with ≥ 2.5 USDC on Base
 *   - Fund wallet with ≥ 0.003 ETH on Arbitrum
 *   - Set SIGNER_PK and DE_BRIDGE_PARTNER_API_KEY in .env
 *
 * Usage: npx tsx src/gasless-intents/total-dst-amount/smoke-test-a-cross-token.ts
 */

import { privateKeyToAccount } from "viem/accounts";
import { randomUUID } from "crypto";
import util from "util";

import { clipHexPrefix, getEnvConfig } from "@utils/index";
import { createBundle, submitBundle } from "@utils/api";
import { processIntentBundle } from "@utils/signatures/intent-signatures";
import { getChainIdToWalletClientMap } from "@utils/wallet";
import { CHAIN_IDS } from "@utils/chains";
import { USDC, EVM_NATIVE_TOKEN } from "@utils/constants";
import { Bundle, BundleProposeBody, Trade, TradingAlgorithm } from "../types";

async function main() {
  const { privateKey } = getEnvConfig();
  const account = privateKeyToAccount(`0x${clipHexPrefix(privateKey)}`);
  const chainIdToWalletClientMap = getChainIdToWalletClientMap(account);

  // USDC on BNB Chain has 18 decimals (not 6 like on most other chains).
  // 5 USDC on BNB = 5 * 10^18 = "5000000000000000000".
  const totalDstAmount = (5n * 10n ** 18n).toString();

  // Trade 1: 2.5 USDC on Base → USDC on BNB
  // srcChainTokenInAmount is an upper bound — the system may take less.
  const baseUsdcToBnbUsdc: Trade = {
    srcChainId: CHAIN_IDS.Base,
    srcChainTokenIn: USDC.Base,               // USDC on Base, 6 decimals
    srcChainTokenInAmount: "2500000",          // 2.5 USDC (6 decimals)

    dstChainId: CHAIN_IDS.BNB,
    dstChainTokenOut: USDC.BNB,               // USDC on BNB, 18 decimals
    dstChainTokenOutAmount: "auto",            // system calculates dst amount
    dstChainTokenOutRecipient: account.address,

    srcChainAuthorityAddress: account.address,
    dstChainAuthorityAddress: account.address,

    prependOperatingExpenses: false,           // required for totalDstAmount
  };

  // Trade 2: 0.003 ETH on Arbitrum → USDC on BNB
  // ETH uses the native token address (zero address).
  const arbEthToBnbUsdc: Trade = {
    srcChainId: CHAIN_IDS.Arbitrum,
    srcChainTokenIn: EVM_NATIVE_TOKEN,         // Native ETH, 18 decimals
    srcChainTokenInAmount: "3000000000000000",  // 0.003 ETH (18 decimals)

    dstChainId: CHAIN_IDS.BNB,
    dstChainTokenOut: USDC.BNB,
    dstChainTokenOutAmount: "auto",
    dstChainTokenOutRecipient: account.address,

    srcChainAuthorityAddress: account.address,
    dstChainAuthorityAddress: account.address,

    prependOperatingExpenses: false,
  };

  // All trades must share the same dst token (USDC) and dst chain (BNB).
  // totalDstAmount tells the system: "I want exactly 5 USDC on BNB."
  // The system iterates trades in order, taking from each source until the
  // cumulative dst amount minus operational expenses equals totalDstAmount.
  const requestBody: BundleProposeBody = {
    requestId: randomUUID(),
    expirationTimestamp: Math.floor((new Date().getTime() * 2) / 1000),
    enableAccountAbstraction: true,  // required for totalDstAmount
    isAtomic: true,
    tradingAlgorithm: TradingAlgorithm.MARKET,
    trades: [
      baseUsdcToBnbUsdc,   // Trade 1: ~2.5 USDC from Base
      arbEthToBnbUsdc,     // Trade 2: ~0.003 ETH from Arb
    ],
    totalDstAmount,         // 5 USDC on BNB (18 decimals)
  };

  // ── Propose ────────────────────────────────────────────────────────
  console.log("Creating bundle with totalDstAmount...");
  console.log(`  totalDstAmount: ${totalDstAmount} (5 USDC, 18 decimals on BNB)`);
  console.log(`  Trades: ${requestBody.trades.length}`);

  const bundle = await createBundle(requestBody);

  console.log("\nBundle created successfully!");
  console.log(JSON.stringify(bundle, null, 2));

  if (bundle.tokenResult && bundle.tokenResult.length > 0) {
    console.log("\n--- Token Results (actual amounts after balancing) ---");
    for (const tr of bundle.tokenResult) {
      console.log(
        `  Chain ${tr.chainId}: ${tr.amount} (~$${tr.approximateUsdValue.toFixed(2)}) -> ${tr.recipientAddress}`,
      );
    }
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
