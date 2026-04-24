import util from "util"
import { randomUUID } from 'crypto';
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";

import { USDC } from '@utils/constants';
import { toHexPrefixString, getEnvConfig } from '@utils/index';
import { getSendErc20Hook } from '@utils/posthooks';
import { createBundle, submitBundle } from '@utils/api';
import { BundleProposeBody, TradingAlgorithm } from "../types";
import { getPolygonUsdcToBaseUsdc, getPolyMaticToBaseUsdc } from "../trades";
import { processIntentBundle } from '@utils/signatures/intent-signatures';
import { getChainIdToWalletClientMap } from '@utils/wallet';

async function main() {
  const { privateKey } = getEnvConfig();

  const account = privateKeyToAccount(toHexPrefixString(privateKey));

  const chainIdToWalletClientMap = getChainIdToWalletClientMap(account);

  const senderAddress = account.address;
  const beneficiaryAddress = "0x6098841a6B27feBdb30e51d07c1BD17499efED38"; // DevRel's 2nd address

  const sendErc20Posthook = await getSendErc20Hook(toHexPrefixString(USDC.Base), base.id, senderAddress, beneficiaryAddress);

  console.log("Send ERC20 PostHook Calldata:", sendErc20Posthook);

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
      sendErc20Posthook
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