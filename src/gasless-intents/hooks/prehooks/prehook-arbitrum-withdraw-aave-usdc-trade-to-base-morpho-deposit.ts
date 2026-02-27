import { privateKeyToAccount } from "viem/accounts";
import util from "util";
import { randomUUID } from "crypto";

import { USDC } from "../../../utils/constants";
import { toHexPrefixString, getEnvConfig } from "../../../utils";
import { getAaveWithdrawExtendedHook, getMorphoDepositExtendedHook } from "../../../utils/posthooks";
import { createBundle, submitBundle } from "../../../utils/api";
import { BundleProposeBody, TradingAlgorithm } from "../../types";
import {
  getArbitrumUsdcToBaseUsdc,
} from "../../trades";
import { processIntentBundle } from "../../../utils/signatures/intent-signatures";
import { getChainIdToWalletClientMap } from "../../../utils/wallet";
import { CHAIN_IDS } from "../../../utils/chains";

async function main() {
  const { privateKey } = getEnvConfig();

  const account = privateKeyToAccount(toHexPrefixString(privateKey));

  const chainIdToWalletClientMap = getChainIdToWalletClientMap(account);

  const AAVE_V3_POOL_ARBITRUM = "0x794a61358D6845594F94dc1DB02A252b5b4814aD";

  // TODO: Figure out the amount 
  const amountToRebalance = "3204714"; // 3.204714 USDC with 6 decimals - this is the amount that will be withdrawn from Aave in the pre-hook and swapped to ETH, adjust as needed

  const arbitrumUsdcAaveWithdraw = await getAaveWithdrawExtendedHook(
    AAVE_V3_POOL_ARBITRUM,
    toHexPrefixString(USDC.Arbitrum),
    CHAIN_IDS.Arbitrum,
    account.address,
    "aaveDepositAmount",
    BigInt(amountToRebalance),
  );

  const morphoDeposit = await getMorphoDepositExtendedHook(toHexPrefixString(USDC.Arbitrum), CHAIN_IDS.Arbitrum, account.address, "morphoDepositAmount");

  console.log("Withdraw Call PreHook Calldata:", arbitrumUsdcAaveWithdraw);

  const requestId = randomUUID();

  const requestBody: BundleProposeBody = {
    requestId,
    referralCode: 110000002,
    expirationTimestamp: Math.floor((new Date().getTime() * 2) / 1000),
    enableAccountAbstraction: true,
    isAtomic: true,
    tradingAlgorithm: TradingAlgorithm.MARKET,
    trades: [getArbitrumUsdcToBaseUsdc(account.address, amountToRebalance)],
    preHooks: [arbitrumUsdcAaveWithdraw],
    postHooks: [morphoDeposit],
  };

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
    referralCode: 110000002,
    requestId: requestBody.requestId,
    enableAccountAbstraction: true,
    isAtomic: true,
    signedData: signedDataArray,
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
