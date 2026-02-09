import { createWalletClient, http } from "viem";
import {
  privateKeyToAccount
} from 'viem/accounts'
import { polygon } from "viem/chains"
import { getEnvConfig, toHexPrefixString } from "./../utils";
import { createBundle, submitBundle } from "./../utils/api";
import { processIntentBundle } from "./../utils/signatures/intent-signatures";
import { randomUUID } from 'crypto';

import util from "util"
import { getSameChainTrade, getCrossChainTrade } from "./../utils/trades";
import { USDT } from "../utils/constants";
import { BundleProposeBody, TradingAlgorithm } from "./types";
import { getChainIdToWalletClientMap } from "../utils/wallet";

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
      getSameChainTrade(account.address), // default USDC on Polygon -> MATIC on Polygon
      getCrossChainTrade(account.address), // default USDC on Polygon -> USDC on BSC
      getCrossChainTrade(account.address, {
        // Only override what you want – everything else defaults
        srcChainTokenInAmount: "1100000", // 1.1 USDC
        srcChainTokenInMinAmount: "900000",
        srcChainTokenInMaxAmount: "1000000",
        dstChainTokenOut: USDT.BNB,        // Default is BSC_USDC, override to USDT
      }),
      getSameChainTrade(account.address, {
        tokenOut: USDT.Polygon,
        tokenOutRecipient: account.address
      })
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