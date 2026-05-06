import { privateKeyToAccount } from "viem/accounts";
import util from "util";
import { randomUUID } from "crypto";

import { PLACEHOLDER_TOKEN_AMOUNT, USDC } from "../../utils/constants";
import { toHexPrefixString, getEnvConfig } from "../../utils";
import { getAaveSupplyHook } from "@utils/hooks";
import { createBundle, submitBundle } from "../../utils/api";
import { BundleProposeBody, ExtendedHook, PlaceHolder, TradingAlgorithm } from "../types";
import { getPolygonUsdcToArbitrumUsdc, getPolyMaticToArbitrumUsdc } from "../trades";
import { processIntentBundle } from "../../utils/signatures/intent-signatures";
import { getChainIdToWalletClientMap } from "../../utils/wallet";
import { CHAIN_IDS } from "../../utils/chains";
import { createApproveCall } from "@utils/contract-calls";
import { replaceNamedPlaceholders } from "@utils/hooks-common";

/**
 * Fund requirements:
 * - Polygon: 3 USDC
 * – Polygon: 0.1 POLY
 */

async function main() {
  const { privateKey } = getEnvConfig();

  const account = privateKeyToAccount(toHexPrefixString(privateKey));

  const chainIdToWalletClientMap = getChainIdToWalletClientMap(account);

  const AAVE_V3_POOL_ARBITRUM = "0x794a61358D6845594F94dc1DB02A252b5b4814aD";

  const arbitrumUsdcAaveDeposit = await getAaveSupplyHook(
    AAVE_V3_POOL_ARBITRUM,
    toHexPrefixString(USDC.Arbitrum),
    CHAIN_IDS.Arbitrum,
    account.address,
    account.address,
  );

  const approveCall = createApproveCall(
    toHexPrefixString(USDC.Arbitrum),
    toHexPrefixString(AAVE_V3_POOL_ARBITRUM),
    BigInt(PLACEHOLDER_TOKEN_AMOUNT),
  );

  const placeholder: PlaceHolder = {
    nameVariable: "amount",
    tokenAddress: USDC.Arbitrum,
    address: account.address,
  };

  approveCall.data = replaceNamedPlaceholders(approveCall.data, [placeholder.nameVariable]);

  const approvePrehook: ExtendedHook = {
    isAtomic: true,
    data: approveCall.data,
    to: approveCall.to,
    value: approveCall.value.toString(),
    chainId: CHAIN_IDS.Arbitrum,
    from: account.address,
    placeHolders: [placeholder],
  };

  console.log("Deposit Call PostHook Calldata:", arbitrumUsdcAaveDeposit);

  const requestId = randomUUID();

  const requestBody: BundleProposeBody = {
    requestId,
    referralCode: 110000002,
    expirationTimestamp: Math.floor((new Date().getTime() * 2) / 1000),
    enableAccountAbstraction: true,
    isAtomic: true,
    tradingAlgorithm: TradingAlgorithm.MARKET,
    trades: [getPolygonUsdcToArbitrumUsdc(account.address)],
    postHooks: [approvePrehook, arbitrumUsdcAaveDeposit],
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
