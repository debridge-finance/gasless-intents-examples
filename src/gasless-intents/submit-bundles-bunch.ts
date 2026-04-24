import { privateKeyToAccount } from "viem/accounts";
import { getEnvConfig, clipHexPrefix } from "@utils/index";
import { createBundle, submitBundle } from "@utils/api";
import { processIntentBundle } from "@utils/signatures/intent-signatures";
import { randomUUID } from "crypto";

import util from "util";
import { Bundle, BundleProposeBody, Trade, TradingAlgorithm } from "./types";
import { getChainIdToWalletClientMap } from "@utils/wallet";
import { CHAIN_IDS } from "@utils/chains";
import { EVM_NATIVE_TOKEN, USDC, USDT } from "@utils/constants";

async function main() {
  // Wallet setup
  const { privateKey } = getEnvConfig();

  const account = privateKeyToAccount(`0x${clipHexPrefix(privateKey)}`);

  const chainIdToWalletClientMap = getChainIdToWalletClientMap(account);

  const requestId = randomUUID();

  const usdcPolyToUsdcBase: Trade = {
    srcChainId: CHAIN_IDS.Polygon,
    srcChainTokenIn: USDC.Polygon,
    srcChainTokenInAmount: "600000", // 0.6 USDC
    srcChainAuthorityAddress: account.address,
    dstChainId: CHAIN_IDS.Base,
    dstChainTokenOut: USDC.Base,
    dstChainTokenOutAmount: "auto",
    dstChainTokenOutRecipient: account.address,
    dstChainAuthorityAddress: account.address,
    prependOperatingExpenses: true,
  };

  const usdcMaticToUsdcEth: Trade = {
    srcChainId: CHAIN_IDS.Polygon,
    srcChainTokenIn: EVM_NATIVE_TOKEN,
    srcChainTokenInAmount: "1000000000000000000", // 1 MATIC
    srcChainAuthorityAddress: account.address,
    dstChainId: CHAIN_IDS.Base,
    dstChainTokenOut: EVM_NATIVE_TOKEN,
    dstChainTokenOutAmount: "auto",
    dstChainTokenOutRecipient: account.address,
    dstChainAuthorityAddress: account.address,
    prependOperatingExpenses: true,
  };

  const arbitrumEthToBaseEth: Trade = {
    srcChainId: CHAIN_IDS.Arbitrum,
    srcChainTokenIn: EVM_NATIVE_TOKEN,
    srcChainTokenInAmount: "1000000000000000", // 0.001 ETH
    srcChainAuthorityAddress: account.address,
    dstChainId: CHAIN_IDS.Base,
    dstChainTokenOut: EVM_NATIVE_TOKEN,
    dstChainTokenOutAmount: "auto",
    dstChainTokenOutRecipient: account.address,
    dstChainAuthorityAddress: account.address,
    prependOperatingExpenses: true,
  };

  const arbitrumUsdtToBaseUsdc: Trade = {
    srcChainId: CHAIN_IDS.Arbitrum,
    srcChainTokenIn: USDT.Arbitrum,
    srcChainTokenInAmount: "2300000", // 2.3 USDT
    srcChainAuthorityAddress: account.address,
    dstChainId: CHAIN_IDS.Base,
    dstChainTokenOut: USDC.Base,
    dstChainTokenOutAmount: "auto",
    dstChainTokenOutRecipient: account.address,
    dstChainAuthorityAddress: account.address,
    prependOperatingExpenses: true,
  };

  // Trades body
  const requestBody: BundleProposeBody = {
    requestId,
    referralCode: 110000002,
    expirationTimestamp: Math.floor((new Date().getTime() * 2) / 1000),
    enableAccountAbstraction: true,
    isAtomic: true,
    tradingAlgorithm: TradingAlgorithm.MARKET,
    trades: [usdcPolyToUsdcBase, usdcMaticToUsdcEth, arbitrumEthToBaseEth, arbitrumUsdtToBaseUsdc],
    postHooks: [],
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

  // Prepare the bundle with intent signatures for submission
  const submitPayload: Bundle = {
    ...bundle,
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
