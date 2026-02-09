import {
  privateKeyToAccount
} from 'viem/accounts'
import { randomUUID } from 'crypto';
import util from "util"

import { getEnvConfig, toHexPrefixString } from "../../utils";
import { createBundle, submitBundle } from "../../utils/api";
import { processIntentBundle } from "../../utils/signatures/intent-signatures";
import {
  getPolyMaticToWethTrade,
  getPolyUsdcToBscUsdcTrade,
  getPolyMaticToBscBnb,
  getPolyMaticToBscBnbStuck
} from "../trades";
import { getChainIdToWalletClientMap } from "../../utils/wallet";
import { Bundle, TradingAlgorithm } from '../types';

async function main() {
  // Wallet setup
  const { privateKey } = getEnvConfig();

  const account = privateKeyToAccount(toHexPrefixString(privateKey));

  const chainToWalletsMap = getChainIdToWalletClientMap(account);

  const requestId = randomUUID();

  // Trades body
  const requestBody = {
    requestId,
    expirationTimestamp: Math.floor(new Date().getTime() * 2 / 1000),
    enableAccountAbstraction: true,
    isAtomic: true,
    tradingAlgorithm: TradingAlgorithm.MARKET,
    trades: [
      getPolyUsdcToBscUsdcTrade(account.address),
      getPolyMaticToWethTrade(account.address),
      getPolyMaticToBscBnb(account.address),
      getPolyMaticToBscBnbStuck(account.address), // 1 Matic for 1 BNB will get it stuck, due to the bundle being atomic
    ],
    postHooks: [],
  }

  console.log("Creating bundle...");
  const bundle = await createBundle(requestBody);
  console.log(JSON.stringify(bundle, null, 2));
  console.log("Bundle created successfully!");

  // Log the first intent for debugging
  if (bundle.intents && bundle.intents.length > 0) {
    console.log("First intent:", util.inspect(bundle.intents[0], { showHidden: false, depth: null, colors: true }));
  }

  // Using processIntentBundle to handle all intents at once
  console.log("Collecting signatures for all intents...");
  const signedDataArray = await processIntentBundle(bundle, chainToWalletsMap);

  console.log(`Generated ${signedDataArray.length} signatures for ${bundle.intents?.length || 0} intents`);

  // Prepare the bundle with intent signatures for submission
  const submitPayload: Bundle = {
    ...bundle,
    requestId: requestBody.requestId,
    enableAccountAbstraction: true,
    isAtomic: true,
    signedData: signedDataArray,
    partnerCancelAuthority: [
      account.address
    ]
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