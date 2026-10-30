/**
 * Fixed input cap: up to 2 USDC on Arbitrum → exactly 1 USDC on Polygon.
 *
 * totalDstAmount is the net destination amount after operating expenses.
 * The single trade supplies the amount needed to reach that target.
 * Fund the source wallet with enough to cover the target and operating expenses.
 *
 * Usage: npx tsx ./src/gasless-intents/trades/total-dst-amount/fixed-usdc-arbitrum-to-polygon.ts
 */

import { privateKeyToAccount } from "viem/accounts";
import { randomUUID } from "crypto";

import { clipHexPrefix } from "@utils/string";
import { getEnvConfig } from "@utils/env";
import { createBundle, submitBundle } from "@utils/gasless-api";
import { processIntentBundle } from "@utils/signatures/intent-signatures";
import { getChainIdToWalletClientMap } from "@utils/wallet";
import { CHAIN_IDS } from "@utils/chains";
import { USDC } from "@utils/constants";
import { Bundle, BundleProposeBody, Trade, TradingAlgorithm, TokenAmount } from "@gasless-intents/types";

async function main() {
  const { privateKey } = getEnvConfig();
  const account = privateKeyToAccount(`0x${clipHexPrefix(privateKey)}`);
  const chainIdToWalletClientMap = getChainIdToWalletClientMap(account);

  // 1 USDC on Polygon (6 decimals).
  const totalDstAmount = (1n * 10n ** 6n).toString();

  // The input amount is an upper bound; the system takes only what is needed.
  const trade: Trade = {
    srcChainId: CHAIN_IDS.Arbitrum,
    srcChainTokenIn: USDC.Arbitrum,
    srcChainTokenInAmount: "2000000",

    dstChainId: CHAIN_IDS.Polygon,
    dstChainTokenOut: USDC.Polygon,
    dstChainTokenOutAmount: TokenAmount.AUTO,
    dstChainTokenOutRecipient: account.address,

    srcChainAuthorityAddress: account.address,
    dstChainAuthorityAddress: account.address,

    prependOperatingExpenses: false,
  };

  const requestBody: BundleProposeBody = {
    requestId: randomUUID(),
    expirationTimestamp: Math.floor((new Date().getTime() * 2) / 1000),
    enableAccountAbstraction: true,
    isAtomic: true,
    tradingAlgorithm: TradingAlgorithm.MARKET,
    trades: [trade],
    totalDstAmount,
  };

  console.log("Creating bundle (USDC on Arbitrum → 1 USDC on Polygon)...");
  console.log(`  totalDstAmount: ${totalDstAmount}`);

  const bundle = await createBundle(requestBody);
  console.log("\nBundle created!");
  console.log(JSON.stringify(bundle, null, 2));

  console.log("\nCollecting signatures...");
  const signedDataArray = await processIntentBundle(bundle, chainIdToWalletClientMap);
  console.log(`Generated ${signedDataArray.length} signatures`);

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
