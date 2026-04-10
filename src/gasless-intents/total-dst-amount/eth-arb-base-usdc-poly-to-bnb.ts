/**
 * Example 3 — ETH Majority Sources with totalDstAmount
 *
 * Consolidate ETH on Arbitrum + ETH on Base + USDC on Polygon into
 * exactly 4 USDC on BNB Chain.
 *
 * Two ETH source trades run before one USDC trade. The system exhausts
 * earlier trades first; whichever trade pushes the cumulative total past
 * the target becomes the balancing trade and gets trimmed.
 *
 * Usage: npx tsx src/gasless-intents/total-dst-amount/eth-arb-base-usdc-poly-to-bnb.ts
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

  // 4 USDC on BNB (18 decimals)
  const totalDstAmount = (4n * 10n ** 18n).toString();

  // ── Trades ─────────────────────────────────────────────────────────

  const arbEthToBnbUsdc: Trade = {
    srcChainId: CHAIN_IDS.Arbitrum,
    srcChainTokenIn: EVM_NATIVE_TOKEN,
    srcChainTokenInAmount: TokenAmount.MAX,

    dstChainId: CHAIN_IDS.BNB,
    dstChainTokenOut: USDC.BNB,
    dstChainTokenOutAmount: TokenAmount.AUTO,
    dstChainTokenOutRecipient: account.address,

    srcChainAuthorityAddress: account.address,
    dstChainAuthorityAddress: account.address,

    prependOperatingExpenses: false,
  };

  const baseEthToBnbUsdc: Trade = {
    srcChainId: CHAIN_IDS.Base,
    srcChainTokenIn: EVM_NATIVE_TOKEN,
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
    enableAccountAbstraction: true,
    isAtomic: true,
    tradingAlgorithm: TradingAlgorithm.MARKET,
    trades: [
      arbEthToBnbUsdc,     // ETH from Arbitrum
      baseEthToBnbUsdc,    // ETH from Base
      polyUsdcToBnbUsdc,   // USDC from Polygon
    ],
    totalDstAmount,
  };

  // ── Propose ────────────────────────────────────────────────────────
  console.log("Creating bundle (2x ETH + USDC → 4 USDC on BNB)...");
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
