import { createWalletClient, http } from "viem";
import {
  privateKeyToAccount
} from 'viem/accounts'
import { polygon } from "viem/chains"
import { getEnvConfig } from "./../utils";
import { createBundle, submitBundle } from "./api-calls";
import { processIntentBundle } from "./signatures/intent-signatures";
import { randomUUID } from 'crypto';

import util from "util"
import { getPolyMaticToBscWbnb, getPolyMaticToWethTrade, getPolyUsdcToBscUsdcTrade, getPolyUsdcToBscWbnbTrade } from "./trades";

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

  const walletClient = createWalletClient({
    account,
    chain: polygon,
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
      getPolyUsdcToBscUsdcTrade(account.address),
      getPolyUsdcToBscWbnbTrade(account.address),
      getPolyMaticToBscWbnb(account.address),
      getPolyMaticToWethTrade(account.address)
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
  const signedDataArray = await processIntentBundle(bundle, walletClient);

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