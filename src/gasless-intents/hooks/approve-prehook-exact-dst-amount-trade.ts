import { privateKeyToAccount } from "viem/accounts";
import util from "util";
import { randomUUID } from "crypto";

import { DE_BRIDGE_CONTRACTS, PLACEHOLDER_TOKEN_AMOUNT, USDC } from "../../utils/constants";
import { toHexPrefixString, getEnvConfig } from "../../utils";
import { createBundle, submitBundle } from "../../utils/api";
import { BundleProposeBody, ExtendedHook, PlaceHolder, Trade, TradingAlgorithm } from "../types";
import { processIntentBundle } from "../../utils/signatures/intent-signatures";
import { getChainIdToWalletClientMap } from "../../utils/wallet";
import { CHAIN_IDS } from "../../utils/chains";
import { createApproveCall } from "../../utils/contract-calls";
import { replaceAmountPlaceholder } from "../../utils/hooks-common";

async function main() {
  const { privateKey } = getEnvConfig();

  const account = privateKeyToAccount(toHexPrefixString(privateKey));

  const chainIdToWalletClientMap = getChainIdToWalletClientMap(account);

  const approveCall = createApproveCall(
    toHexPrefixString(USDC.Arbitrum),
    toHexPrefixString(DE_BRIDGE_CONTRACTS.EVM.AllowanceHolder),
    BigInt(PLACEHOLDER_TOKEN_AMOUNT),
  );

  approveCall.data = replaceAmountPlaceholder(approveCall.data);

  const placeholder: PlaceHolder = {
    nameVariable: "amount",
    tokenAddress: USDC.Arbitrum,
    address: account.address
  }

  const approvePrehook: ExtendedHook = {
    isAtomic: true,
    data: approveCall.data,
    to: approveCall.to,
    value: approveCall.value.toString(),
    chainId: CHAIN_IDS.Arbitrum,
    from: account.address,
    placeHolders: [placeholder],
  };

  const requestId = randomUUID();

  const trade: Trade = {
    srcChainId: CHAIN_IDS.Arbitrum,
    srcChainTokenIn: USDC.Arbitrum,
    srcChainTokenInAmount: "auto",
    dstChainId: CHAIN_IDS.Base,
    dstChainTokenOut: USDC.Base,
    dstChainTokenOutAmount: "3000000", // 3 USDC
    srcChainAuthorityAddress: account.address,
    dstChainTokenOutRecipient: account.address,
    dstChainAuthorityAddress: account.address,
    prependOperatingExpenses: true,
  };

  const requestBody: BundleProposeBody = {
    requestId,
    referralCode: 110000002,
    expirationTimestamp: Math.floor((new Date().getTime() * 2) / 1000),
    enableAccountAbstraction: true,
    isAtomic: true,
    tradingAlgorithm: TradingAlgorithm.MARKET,
    trades: [trade],
    preHooks: [approvePrehook],
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
