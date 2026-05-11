import { privateKeyToAccount } from "viem/accounts";
import { randomUUID } from "crypto";

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
      arbAaveUsdcToBnbUsdc     // processed third (balancing trade)
    ],
    preHooks: [aaveWithdrawHook],
    totalDstAmount,
  };

  // ── Propose ────────────────────────────────────────────────────────
  console.log("\nCreating bundle (AAVE withdraw balancing → 8 USDC on BNB)...");
  console.log(`  totalDstAmount: ${totalDstAmount}`);
  console.log(`  Trades: 2 × max/auto`);

  const bundle = await createBundle(requestBody);
  console.log("\nBundle created!");
  console.log(JSON.stringify(bundle, null, 2));

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
