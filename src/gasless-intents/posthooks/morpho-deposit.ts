import { privateKeyToAccount } from "viem/accounts";
import util from "util"
import { randomUUID } from 'crypto';

import { USDC } from "../../utils/constants";
import { toHexPrefixString, getEnvConfig } from "../../utils";
import { getMorphoDepositPosthook } from "../../utils/posthooks";
import { createBundle, submitBundle } from "../../utils/api";
import { BundleProposeBody, TradingAlgorithm } from "../types";
import { getPolygonUsdcToBaseUsdc, getPolyMaticToBaseUsdc } from "../trades";
import { processIntentBundle } from "../../utils/signatures/intent-signatures";
import { getChainIdToWalletClientMap } from "../../utils/wallet";

async function main() {
  const { privateKey } = getEnvConfig();

  const account = privateKeyToAccount(toHexPrefixString(privateKey));

  const chainIdToWalletClientMap = getChainIdToWalletClientMap(account);

  const baseUsdcMorphoDeposit = await getMorphoDepositPosthook(toHexPrefixString(USDC.Base), 8453, account.address);

  console.log("Deposit Call PostHook Calldata:", baseUsdcMorphoDeposit);

  const requestId = randomUUID();

  const requestBody: BundleProposeBody = {
    requestId,
    expirationTimestamp: Math.floor(new Date().getTime() * 2 / 1000),
    enableAccountAbstraction: true,
    isAtomic: true,
    tradingAlgorithm: TradingAlgorithm.MARKET,
    trades: [
      getPolygonUsdcToBaseUsdc(account.address),
      getPolyMaticToBaseUsdc(account.address),
    ],
    postHooks: [
      baseUsdcMorphoDeposit
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