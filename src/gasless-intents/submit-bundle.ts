import { createWalletClient, http } from "viem";
import {
  privateKeyToAccount
} from 'viem/accounts'
import {arbitrum, base, bsc, optimism, polygon} from "viem/chains"
import { getEnvConfig } from "./../utils";
import { createBundle, submitBundle } from "./api-calls";
import { processIntentBundle } from "./signatures/intent-signatures";
import { randomUUID } from 'crypto';

import util from "util"
import {
  getPolyUsdcToPolyWETH,
  getPolyMaticToBscWbnb,
  getPolyMaticToWethTrade,
  getPolyUsdcToBscUsdcTrade,
  getPolyUsdcToBscWbnbTrade,
  getBscNativeToUsdc,
  getPolyMaticToBscUsdc,
  getBscNativeToPolNativeTrade,
  getPolyMaticToBscBnb,
  getBaseEthToBscWbnb,
  getArbitrumEthToBscWbnb, getOptimismEthToBscWbnb,
  getArbitrumEthToBaseEth,
  getPolyMaticToBaseUsdc,
  getBscNativeToBaseUsdc,
  getOptimismEthToBaseEth,
  getBaseEthToBaseUsdc, getOptimismEthToRandomToken, getArbitrumEthToUsde, getBaseDegenToBaseUsdc, getPolyLinkToBaseUsdc
} from "./trades";

function remove0xPrefix(input: string): string {
  if (input.startsWith("0x")) {
    return input.slice(2);
  }
  return input;
}

async function main() {
  // Wallet setup
  const { privateKey } = getEnvConfig();

  const account = privateKeyToAccount(`0x${remove0xPrefix(privateKey)}`);

  const walletClientPolygon = createWalletClient({
    account,
    chain: polygon,
    transport: http()
  });

  const walletClientBsc = createWalletClient({
    account,
    chain: bsc,
    transport: http()
  });

  const walletClientBase = createWalletClient({
    account,
    chain: base,
    transport: http()
  });

  const walletClientArbitrum = createWalletClient({
    account,
    chain: arbitrum,
    transport: http()
  });

  const walletClientOptimism = createWalletClient({
    account,
    chain: optimism,
    transport: http()
  });

  const requestId = randomUUID();

  // Trades body
  const requestBody = {
    requestId,
    expirationTimestamp: Math.floor(new Date().getTime() * 2 / 1000),
    enableAccountAbstraction: true,
    isAtomic: true,
    tradingAlgorithm: "market",
    trades: [
      getBscNativeToBaseUsdc(account.address),
      getPolyMaticToBaseUsdc(account.address),
      getBaseEthToBaseUsdc(account.address),
      getBaseDegenToBaseUsdc(account.address),
      getArbitrumEthToBaseEth(account.address),
      getOptimismEthToBaseEth(account.address),


      //getBscNativeToPolNativeTrade(account.address)
      //getBscNativeToBaseEth(account.address),
      //getPolyMaticToBaseEth(account.address),
      //getBscNativeToBaseEth(account.address),
      //getBaseEthToBaseEth(account.address),
      //getArbitrumEthToBaseEth(account.address),
     // getOptimismEthToBaseEth(account.address),


      //getOptimismEthToRandomToken(account.address),
      //getArbitrumEthToUsde(account.address),


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
    "postHooks": [
      {
        "isAtomic": true,
        //data: '0x6e553f650000000000000000000000000000000000000000000000000000000000002710000000000000000000000000541a7e03dcc8f425f6a0797333d5926d89aeb51f',
        "data": "0x6e553f65{amount}000000000000000000000000541a7e03dcc8f425f6a0797333d5926d89aeb51f",
        "to": "0xAcB0DCe4b0FF400AD8F6917f3ca13E434C9ed6bC",
        "value": "0",
        "chainId": 137,
        "tokenAddress": "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359",
        "from": "0x541A7e03dCC8F425F6a0797333d5926D89AeB51f"
      }
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
  const signedDataArray = await processIntentBundle(bundle, {
    137: walletClientPolygon,
    56: walletClientBsc,
    8453: walletClientBase,
    [arbitrum.id]: walletClientArbitrum,
    [optimism.id]: walletClientOptimism
  });

  console.log(`Generated ${signedDataArray.length} signatures for ${bundle.intents?.length || 0} intents`);

  // Prepare the bundle with signatures - but don't submit yet
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