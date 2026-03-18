import {
  privateKeyToAccount
} from 'viem/accounts'
import { getEnvConfig, clipHexPrefix } from '@utils/index';
import { createBundle, submitBundle } from '@utils/api';
import { processIntentBundle } from '@utils/signatures/intent-signatures';
import { randomUUID } from 'crypto';

import util from "util"
import {
  getPolyUsdcToBscUsdcTrade,
  getPolyMaticToBscBnb,
  getPolyMaticToWethTradeV1_1
} from "./trades";
import { Bundle, BundleProposeBody, TradingAlgorithm } from "./types";
import { getChainIdToWalletClientMap } from '@utils/wallet';

async function main() {
  // Wallet setup
  const { privateKey } = getEnvConfig();

  const account = privateKeyToAccount(`0x${clipHexPrefix(privateKey)}`);

  const chainIdToWalletClientMap = getChainIdToWalletClientMap(account);

  const requestId = randomUUID();

  // Trades body
  const requestBody: BundleProposeBody = {
    requestId,
    referralCode: 110000002,
    expirationTimestamp: Math.floor(new Date().getTime() * 2 / 1000),
    enableAccountAbstraction: true,
    isAtomic: true,
    tradingAlgorithm: TradingAlgorithm.MARKET,
    trades: [
      getPolyUsdcToBscUsdcTrade(account.address),
      getPolyMaticToWethTradeV1_1(account.address, account.address),
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
      // {
      //   "isAtomic": true,
      //   //data: '0x6e553f650000000000000000000000000000000000000000000000000000000000002710000000000000000000000000541a7e03dcc8f425f6a0797333d5926d89aeb51f',
      //   "data": "0x6e553f65{amount}000000000000000000000000541a7e03dcc8f425f6a0797333d5926d89aeb51f",
      //   "to": "0xAcB0DCe4b0FF400AD8F6917f3ca13E434C9ed6bC",
      //   "value": "0",
      //   "chainId": 137,
      //   "tokenAddress": USDC.Polygon,
      //   "from": "0x541A7e03dCC8F425F6a0797333d5926D89AeB51f"
      // }
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

  // Prepare the bundle with intent signatures for submission
  const submitPayload: Bundle = {
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