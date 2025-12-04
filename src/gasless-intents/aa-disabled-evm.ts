import {
  privateKeyToAccount
} from 'viem/accounts'
import { getEnvConfig, clipHexPrefix } from "./../utils";
import { createBundle, submitBundle } from "./../utils/api";
import { processIntentBundle } from "../utils/signatures/intent-signatures";
import { randomUUID } from 'crypto';

import util from "util"
import {
  getPolyMaticToBscBnb} from "./trades";
import { Bundle, BundleProposeBody, TradingAlgorithm } from "./types";
import { getChainIdToWalletClientMap } from "../utils/wallet";

async function main() {
  // Wallet setup
  const { privateKey } = getEnvConfig();

  const account = privateKeyToAccount(`0x${clipHexPrefix(privateKey)}`);

  const chainIdToWalletClientMap = getChainIdToWalletClientMap(account);

  const requestId = randomUUID();

  // Trades body
  const requestBody: BundleProposeBody = {
    requestId,
    expirationTimestamp: Math.floor(new Date().getTime() * 2 / 1000),
    enableAccountAbstraction: false,
    isAtomic: true,
    tradingAlgorithm: TradingAlgorithm.MARKET,
    trades: [
      // getPolyUsdcToBscUsdcTrade(account.address),
      // getPolyMaticToWethTradeV1_1(account.address, account.address),
      getPolyMaticToBscBnb(account.address),

      // getPolygonDaiToUSDC(account.address)

      //getBscNativeToPolNativeTrade(account.address)
      //getBscNativeToBaseEth(account.address),
      //getPolyMaticToBaseEth(account.address),
      //getBscNativeToBaseEth(account.address),
      //getBaseEthToBaseEth(account.address),
      //getArbitrumEthToBaseEth(account.address),
      // getOptimismEthToBaseEth(account.address),


      //getOptimismEthToSynthUSD(account.address),
      //getArbitrumEthToWbtc(account.address),


      //getOptimismEthToBaseEth(account.address)


      //getPolyUsdcToBscUsdcTrade(account.address),
      //getPolyUsdcToPolyWETH(account.address),
      //getPolyUsdcToBscUsdcTrade(account.address),

      // getPolyMaticToBscWbnb(account.address),

      //getPolyMaticToBscBnb(account.address),
      //getPolyMaticToBscBnb(account.address),
      //getPolyMaticToBscWbnb(account.address),

      //getPolyUsdcToBscUsdcTrade(account.address),
      //getPolyUsdcToBscWbnbTrade(account.address),
      //getPolyMaticToBscWbnb(account.address),
      // getPolyMaticToWethTrade(account.address)
      //getBscNativeToPolNativeTrade(account.address)
    ],
    postHooks: [
    ],
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
  const signedDataArray = await processIntentBundle(bundle, chainIdToWalletClientMap);

  console.log(`Generated ${signedDataArray.length} signatures for ${bundle.intents?.length || 0} intents`);

  // Prepare the bundle with signatures - but don't submit yet
  const submitPayload: Bundle = {
    ...bundle,
    requestId: requestBody.requestId,
    enableAccountAbstraction: false,
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