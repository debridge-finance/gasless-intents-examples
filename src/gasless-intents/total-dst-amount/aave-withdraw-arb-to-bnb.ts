/**
 * Example 4 — AAVE Withdraw as the Balancing Trade (auto → auto)
 *
 * Consolidate USDC from Base + Polygon, then use an AAVE V3 withdraw on
 * Arbitrum as the auto → auto balancing trade → 8 USDC on BNB Chain.
 *
 * The auto → auto trade:
 *   Both srcChainTokenInAmount and dstChainTokenOutAmount are "auto".
 *   This is used when the wallet on the source chain is EMPTY at proposal
 *   time — funds will arrive via the pre-hook (AAVE withdraw). The system
 *   calculates the exact amount to withdraw and substitutes it into the
 *   pre-hook's placeholder.
 *
 * The auto → auto trade must be last in the array. After the system
 * processes the earlier trades and knows the remaining shortfall, it
 * calculates how much to withdraw from AAVE to cover the difference.
 *
 * Pre-hook construction:
 *   Uses ExtendedHook with a PlaceHolder. The calldata encodes
 *   `withdraw(USDC, PLACEHOLDER, signer)`. The PLACEHOLDER bytes are
 *   replaced with a named variable `{aaveWithdrawAmount}` that the
 *   system fills in at execution time.
 *
 * Prerequisites:
 *   - Fund wallet with USDC on Base and Polygon
 *   - Have an active AAVE V3 USDC deposit on Arbitrum
 *   - Set SIGNER_PK and DE_BRIDGE_PARTNER_API_KEY in .env
 *
 * Usage: npx tsx src/gasless-intents/total-dst-amount/aave-withdraw-arb-to-bnb.ts
 */

import { privateKeyToAccount } from "viem/accounts";
import { randomUUID } from "crypto";
import util from "util";

import { clipHexPrefix, getEnvConfig, toHexPrefixString } from "@utils/index";
import { createBundle, submitBundle } from "@utils/api";
import { processIntentBundle } from "@utils/signatures/intent-signatures";
import { getChainIdToWalletClientMap } from "@utils/wallet";
import { CHAIN_IDS } from "@utils/chains";
import { USDC, AAVE_V3_POOL_ARBITRUM } from "@utils/constants";
import { getAaveWithdrawExtendedHook } from "@utils/hooks/prepared";
import { Bundle, BundleProposeBody, Trade, TradingAlgorithm, TokenAmount } from "../types";

async function main() {
  const { privateKey } = getEnvConfig();
  const account = privateKeyToAccount(`0x${clipHexPrefix(privateKey)}`);
  const chainIdToWalletClientMap = getChainIdToWalletClientMap(account);

  // 8 USDC on BNB (18 decimals)
  const totalDstAmount = (8n * 10n ** 18n).toString();

  // ── Trades ─────────────────────────────────────────────────────────

  // Trade 1: USDC on Base → USDC on BNB (max / auto)
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

  // Trade 2: USDC on Polygon → USDC on BNB (max / auto)
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

  // Trade 3: USDC on Arbitrum → USDC on BNB (auto / auto — balancing trade)
  // The wallet is empty on Arbitrum. Funds arrive via the AAVE withdraw pre-hook.
  // The system calculates both srcAmount and dstAmount for this trade.
  const arbAaveUsdcToBnbUsdc: Trade = {
    srcChainId: CHAIN_IDS.Arbitrum,
    srcChainTokenIn: USDC.Arbitrum,
    srcChainTokenInAmount: TokenAmount.AUTO,    // balancing trade — system calculates src

    dstChainId: CHAIN_IDS.BNB,
    dstChainTokenOut: USDC.BNB,
    dstChainTokenOutAmount: TokenAmount.AUTO,   // balancing trade — system calculates dst
    dstChainTokenOutRecipient: account.address,

    srcChainAuthorityAddress: account.address,
    dstChainAuthorityAddress: account.address,

    prependOperatingExpenses: false,
  };

  // ── Pre-hook: AAVE V3 Withdraw ────────────────────────────────────
  // Withdraws USDC from AAVE V3 on Arbitrum into the signer's wallet.
  // The withdraw amount is a placeholder — the system fills in the exact
  // value it calculated for the balancing trade.
  // Uses getAaveWithdrawExtendedHook from utils/hooks/prepared.ts which
  // encodes withdraw(USDC, PLACEHOLDER, signer) and replaces PLACEHOLDER
  // bytes with the named variable for runtime substitution.
  const aaveWithdrawHook = await getAaveWithdrawExtendedHook(
    toHexPrefixString(AAVE_V3_POOL_ARBITRUM),  // AAVE V3 Pool on Arbitrum
    toHexPrefixString(USDC.Arbitrum),            // asset to withdraw
    CHAIN_IDS.Arbitrum,                          // chain where AAVE lives
    account.address,                             // beneficiary (receives withdrawn USDC)
    "aaveWithdrawAmount",                        // placeholder name in calldata
  );

  console.log("AAVE withdraw pre-hook:", JSON.stringify(aaveWithdrawHook, null, 2));

  // ── Bundle ─────────────────────────────────────────────────────────

  const requestBody: BundleProposeBody = {
    requestId: randomUUID(),
    expirationTimestamp: Math.floor((new Date().getTime() * 2) / 1000),
    enableAccountAbstraction: true,
    isAtomic: true,
    tradingAlgorithm: TradingAlgorithm.MARKET,
    trades: [
      baseUsdcToBnbUsdc,       // processed first
      polyUsdcToBnbUsdc,       // processed second
      arbAaveUsdcToBnbUsdc,    // auto/auto — balancing trade, must be last
    ],
    totalDstAmount,
    preHooks: [aaveWithdrawHook],
  };

  // ── Propose ────────────────────────────────────────────────────────
  console.log("\nCreating bundle (AAVE withdraw balancing → 8 USDC on BNB)...");
  console.log(`  totalDstAmount: ${totalDstAmount}`);
  console.log(`  Trades: 2 × max/auto + 1 × auto/auto (balancing)`);

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
