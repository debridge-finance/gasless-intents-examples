import {
  privateKeyToAccount
} from 'viem/accounts'
import { getEnvConfig, toHexPrefixString } from "./../utils";
import { createBundle, submitBundle } from "./../utils/api";
import { processIntentBundle } from "./../utils/signatures/intent-signatures";
import { randomUUID } from 'crypto';

import util from "util"
import { BundleProposeBody, TradingAlgorithm } from "./types";
import { getChainIdToWalletClientMap } from '@utils/wallet';
import { getPolyUsdcToBscUsdcTrade, getPolyUsdcToBscUsdt, getPolyUsdcToMatic, getPolyUsdcToPolyUsdt } from './trades';

async function main() {
  // Wallet setup
  const { privateKey } = getEnvConfig();

  const account = privateKeyToAccount(toHexPrefixString(privateKey));

  const chainIdToWalletClientMap = getChainIdToWalletClientMap(account);

  const requestId = randomUUID();

  // Trades body
  const requestBody: BundleProposeBody = {
    requestId,
    expirationTimestamp: Math.floor(new Date().getTime() * 2 / 1000),
    enableAccountAbstraction: true,
    isAtomic: true,
    tradingAlgorithm: TradingAlgorithm.MARKET,
    referralCode: 110000002,
    trades: [
      getPolyUsdcToMatic(account.address), // default USDC on Polygon -> MATIC on Polygon
      getPolyUsdcToBscUsdcTrade(account.address), // default USDC on Polygon -> USDC on BSC
      getPolyUsdcToBscUsdt(account.address),
      getPolyUsdcToPolyUsdt(account.address)
    ],
    preHooks: [],
    postHooks: []
  }

  console.log("Creating bundle...");
  const bundle = await createBundle(requestBody);
  console.log("Bundle created successfully!");

  // Log the first intent for debugging
  if (bundle.intents && bundle.intents.length > 0) {
    console.log("First intent:", util.inspect(bundle.intents[0], { showHidden: false, depth: null, colors: true }));
  }

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