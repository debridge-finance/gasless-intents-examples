import { privateKeyToAccount } from "viem/accounts";
import { randomUUID } from "crypto";

import { clipHexPrefix } from "@utils/string";
import { getEnvConfig } from "@utils/env";
import { createBundle, submitBundle } from "@utils/gasless-api";
import { processIntentBundle } from "@utils/signatures/intent-signatures";
import { getChainIdToWalletClientMap } from "@utils/wallet";
import { CHAIN_IDS } from "@utils/chains";
import { USDC } from "@utils/constants";
import { Bundle, BundleProposeBody, Trade, TradingAlgorithm, TokenAmount } from "../../types";

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

  // ── Bundle ─────────────────────────────────────────────────────────

  const requestBody: BundleProposeBody = {
    requestId: randomUUID(),
    expirationTimestamp: Math.floor((new Date().getTime() * 2) / 1000),
    enableAccountAbstraction: true,
    isAtomic: true,
    tradingAlgorithm: TradingAlgorithm.MARKET,
    trades: [
      baseUsdcToBnbUsdc,
      polyUsdcToBnbUsdc,
    ],
    totalDstAmount,
  };

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
