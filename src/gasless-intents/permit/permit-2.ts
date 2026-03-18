import util from "util"
import { randomUUID } from 'crypto';
import { privateKeyToAccount } from "viem/accounts";

import { toHexPrefixString, getEnvConfig } from "../../utils";
import { createBundle, submitBundle } from "../../utils/api";
import { ApprovalMode, ApproveAmount, BundleProposeBody, Trade, TradingAlgorithm } from "../types";
import { processIntentBundle } from "../../utils/signatures/intent-signatures";
import { getChainIdToWalletClientMap } from "../../utils/wallet";
import { CHAIN_IDS } from "../../utils/chains";
import { USDC, USDT } from "../../utils/constants";

async function main() {
  const { privateKey } = getEnvConfig();

  const account = privateKeyToAccount(toHexPrefixString(privateKey));

  const chainIdToWalletClientMap = getChainIdToWalletClientMap(account);

  const senderAddress = account.address;
  
  const requestId = randomUUID();

  const uniPermitTrade: Trade = {
    srcChainId: CHAIN_IDS.Base,
    srcChainTokenIn: USDT.Base,
    srcChainTokenInAmount: "1000000", // 1 USDT
    srcChainTokenInMinAmount: "1000000", // 1 USDT
    srcChainTokenInMaxAmount: "1000000", // 1 USDT
    dstChainId: CHAIN_IDS.Polygon,
    dstChainTokenOut: USDC.Polygon,
    dstChainTokenOutAmount: "auto",
    dstChainTokenOutRecipient: senderAddress,
    srcChainAuthorityAddress: senderAddress,
    dstChainAuthorityAddress: senderAddress,
    prependOperatingExpenses: true
  }

  const requestBody: BundleProposeBody = {
    requestId,
    expirationTimestamp: Math.floor(new Date().getTime() * 2 / 1000),
    enableAccountAbstraction: true,
    isAtomic: true,
    tradingAlgorithm: TradingAlgorithm.MARKET,
    preHooks: [],
    trades: [
      uniPermitTrade
    ],
    postHooks: [],
    approvalMode: ApprovalMode.Permit,
    approveAmountFlag: ApproveAmount.Unlimited
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