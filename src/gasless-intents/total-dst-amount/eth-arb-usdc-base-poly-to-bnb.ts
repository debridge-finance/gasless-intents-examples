/**
 * Example 2 — Mixed Source Tokens (ETH + USDC) with totalDstAmount
 *
 * Consolidate ETH on Arbitrum + USDC on Base and Polygon into exactly
 * 3 USDC on BNB Chain.
 *
 * Demonstrates that source tokens can differ across trades — what matters
 * is that all trades share the same destination token and chain.
 * The totalDstAmount is always expressed in the destination token (USDC on
 * BNB, 18 decimals), regardless of the source token types.
 *
 * Trade ordering matters: the system processes trades sequentially. The ETH
 * trade is first, so the system converts ETH at the current market rate
 * before moving to the USDC trades.
 *
 * Usage: npx tsx src/gasless-intents/total-dst-amount/eth-arb-usdc-base-poly-to-bnb.ts
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
import { Bundle, BundleProposeBody, Trade, TradingAlgorithm, TokenAmount } from "../types";

async function main() {
  const { privateKey } = getEnvConfig();
  const account = privateKeyToAccount(`0x${clipHexPrefix(privateKey)}`);
  const chainIdToWalletClientMap = getChainIdToWalletClientMap(account);

  // 3 USDC on BNB (18 decimals)
  const totalDstAmount = (3n * 10n ** 18n).toString();

  // ── Trades ─────────────────────────────────────────────────────────

  // Trade 1: ETH on Arbitrum → USDC on BNB
  // Native ETH uses the zero address. The system converts ETH to USDC
  // at the current market rate.
  const arbEthToBnbUsdc: Trade = {
    srcChainId: CHAIN_IDS.Arbitrum,
    srcChainTokenIn: EVM_NATIVE_TOKEN,         // native ETH, 18 decimals
    srcChainTokenInAmount: TokenAmount.MAX,

    dstChainId: CHAIN_IDS.BNB,
    dstChainTokenOut: USDC.BNB,
    dstChainTokenOutAmount: TokenAmount.AUTO,
    dstChainTokenOutRecipient: account.address,

    srcChainAuthorityAddress: account.address,
    dstChainAuthorityAddress: account.address,

    prependOperatingExpenses: false,
  };

  // Trade 2: USDC on Base → USDC on BNB
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

  // Trade 3: USDC on Polygon → USDC on BNB
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
    enableAccountAbstraction: true,
    isAtomic: true,
    tradingAlgorithm: TradingAlgorithm.MARKET,
    trades: [
      arbEthToBnbUsdc,     // ETH first — converted at market rate
      baseUsdcToBnbUsdc,
      polyUsdcToBnbUsdc,
    ],
    totalDstAmount,
  };

  // ── Propose ────────────────────────────────────────────────────────
  console.log("Creating bundle (mixed ETH + USDC → 3 USDC on BNB)...");
  console.log(`  totalDstAmount: ${totalDstAmount}`);

  const bundle = await createBundle(requestBody);
  console.log("\nBundle created!");
  console.log(JSON.stringify(bundle, null, 2));

  if (bundle.tokenResult?.length) {
    console.log("\n--- Token Results ---");
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

  console.log("\nSubmitting...");
  const submitResponse = await submitBundle(submitPayload);
  console.log("Submit response:", submitResponse);
}

main().catch((error) => {
  console.error("\nFATAL ERROR in script execution:", error);
  process.exitCode = 1;
});
