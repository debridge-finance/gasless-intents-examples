
import { randomUUID } from 'crypto';
import { privateKeyToAccount } from "viem/accounts";
import { polygon } from "viem/chains";

import { toHexPrefixString } from "@utils/index";
import { getEnvConfig } from "@utils/env";
import { createBundle, submitBundle } from '@utils/gasless-api';
import { BundleProposeBody, TradingAlgorithm } from "@gasless-intents/types";
import { getPolygonUsdcToBaseEth, getPolyMaticToBaseEth } from "@gasless-intents/trade-blueprints";
import { processIntentBundle } from '@utils/signatures/intent-signatures';
import { getChainIdToWalletClientMap } from '@utils/wallet';
import { getSendNativeAssetHook } from "@utils/hooks/native-assets";

/**
 * Pre-requisites:
 * - Polygon: 2.3 USDC, 5 MATIC
 * Transfers 2.3 USDC and 2 MATIC from Polygon into USDC on Base
 * 3 MATIC are transferred to the beneficiary address on Polygon.
 *
 * The reasoning is – sendAmount is used as the Placeholder.additionalAmount
 * value in the transfer hook, which resolves to the cumulativeAmount + additionalAmount
 * when executing the hook. 2 MATIC is equal to the cumulative amount of the bundle,
 * and the additionalAmount is set to 1 MATIC, which makes the total transferred amount
 * in the prehook equal to 3 MATIC. 
 * 
 * This is something that partners who want to make complex bundles should be aware of.
 * 
 * Cumulative amount explanation can be found here: https://gasless-docs.debridge.finance/hooks/hooks#resolution-rules
 * 
 * An example transaction can be found here: https://polygonscan.com/tx/0x1dca8c32b98515f4d7a1be7f36cc0e606da2fcffff70f4ed5b0043adc3fd9836
 * Bundle: https://anchorage.debridge.com/bundle/0xcae6ffd2c71052a7f2c632f514af9c9408b7d400a4445dda082a8b5a458d433f
 */
async function main() {
  const { privateKey } = getEnvConfig();

  const account = privateKeyToAccount(toHexPrefixString(privateKey));

  const chainIdToWalletClientMap = getChainIdToWalletClientMap(account);

  const beneficiaryAddress = "0x6098841a6B27feBdb30e51d07c1BD17499efED38"; // DevRel's 2nd address
  const sendAmount = "1000000000000000000"; // 1 MATIC (18 decimals)

  const sentNativeAssetHook = getSendNativeAssetHook(
    account.address,
    beneficiaryAddress,
    polygon.id,
    sendAmount,
  );

  console.log("Send Native PreHook Calldata:", sentNativeAssetHook);

  const requestId = randomUUID();

  const requestBody: BundleProposeBody = {
    requestId,
    expirationTimestamp: Math.floor(new Date().getTime() * 2 / 1000),
    enableAccountAbstraction: true,
    isAtomic: true,
    tradingAlgorithm: TradingAlgorithm.MARKET,
    preHooks: [sentNativeAssetHook],
    trades: [
      getPolygonUsdcToBaseEth(account.address),
      getPolyMaticToBaseEth(account.address),
    ],
    postHooks: [],
  }

  console.log("Creating bundle...");
  const bundle = await createBundle(requestBody);

  console.log(JSON.stringify(bundle, null, 2));
  console.log("Bundle created successfully!");

  // Using processIntentBundle to handle all intents at once
  console.log("Collecting signatures for all intents...");
  const signedDataArray = await processIntentBundle(bundle, chainIdToWalletClientMap);

  console.log(`Generated ${signedDataArray.length} signatures for ${bundle.intents?.length || 0} intents`);

  // Prepare the bundle with intent signatures for submission
  const submitPayload = {
    ...bundle,
    requestId: requestBody.requestId,
    enableAccountAbstraction: true,
    isAtomic: true,
    signedData: signedDataArray
  };

  console.log("Payload prepared with signatures. Ready for submission.");

  const submitResponse = await submitBundle(submitPayload);
  console.log("Submit response:", submitResponse);

  return submitPayload;
}

main().catch((error) => {
  console.error("\n🚨 FATAL ERROR in script execution:", error);
  process.exitCode = 1;
});