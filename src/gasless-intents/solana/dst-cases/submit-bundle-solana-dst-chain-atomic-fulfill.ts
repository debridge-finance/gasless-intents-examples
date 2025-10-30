import { privateKeyToAccount } from 'viem/accounts'
import { getEnvConfig, toHexPrefixString } from "../../../utils";
import { randomUUID } from 'crypto';

import util from "util"
import { getPolyUsdcToSolJupTrade, getPolyUsdcToSolUsdcTrade } from "../../trades";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { getApi } from "../../../utils/api";
import { processIntentBundle } from "../../../utils/signatures/intent-signatures";
import { ApiVersion, TradingAlgorithm } from "../../types";
import { getChainIdToWalletClientMap } from "../../../utils/wallet";
import { BASE_DEV_URL } from '../../../utils/constants';

const { createBundle, submitBundle } = getApi(BASE_DEV_URL);

async function main() {
  // Wallet setup
  const { privateKey, solPrivateKey } = getEnvConfig();

  const account = privateKeyToAccount(toHexPrefixString(privateKey));

  const chainIdToWalletClientMap = getChainIdToWalletClientMap(account);

  console.log(`account: ${account.address}`)

  const requestId = randomUUID();

  const solanaKey = Keypair.fromSecretKey(bs58.decode(solPrivateKey));
  const solanaAddress = solanaKey.publicKey.toBase58();

  // Trades body
  const requestBody = {
    requestId,
    expirationTimestamp: Math.floor(new Date().getTime() * 2 / 1000),
    enableAccountAbstraction: true,
    isAtomic: true,
    tradingAlgorithm: TradingAlgorithm.MARKET,
    trades: [
      getPolyUsdcToSolUsdcTrade(account.address, solanaAddress, solanaAddress),
      getPolyUsdcToSolJupTrade(account.address, solanaAddress, solanaAddress),
    ],
    preHooks: [],
    postHooks: []
  }

  console.log(`Creating bundle..., ${JSON.stringify(requestBody)}`);
  const bundle = await createBundle(requestBody);
  console.log("Bundle created successfully!");

  // Log the first intent for debugging
  if (bundle.intents && bundle.intents.length > 0) {
    console.log("First intent:", util.inspect(bundle.intents[0], { showHidden: false, depth: null, colors: true }));
  }

  // Using processIntentBundle to handle all intents at once
  console.log("Collecting signatures for all intents...");
  const signedDataArray = await processIntentBundle(bundle, chainIdToWalletClientMap, ApiVersion.V1_1);

  console.log(`Generated ${signedDataArray.length} signatures for ${bundle.intents?.length || 0} intents`);

  // Prepare the bundle with signatures - but don't submit yet
  const submitPayload = {
    ...bundle,
    requestId: requestBody.requestId,
    enableAccountAbstraction: true,
    isAtomic: true,
    signedData: signedDataArray
  };

  console.log(`Payload prepared with signatures. Ready for submission. payload: ${JSON.stringify(submitPayload)}`);

  console.log("Payload prepared with signatures. Ready for submission.");

  const submitResponse = await submitBundle(submitPayload);
  console.log("Submit response:", submitResponse);

  return submitPayload;
}

main().catch((error) => {
  console.error("\n🚨 FATAL ERROR in script execution:", error);
  process.exitCode = 1;
});
