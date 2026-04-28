import util from "util";
import { randomUUID } from "crypto";
import { privateKeyToAccount } from "viem/accounts";

import { toHexPrefixString, getEnvConfig } from "../../../utils";
import { createBundle, submitBundle } from "../../../utils/api";
import { BundleProposeBody, ExtendedHook, TradingAlgorithm } from "../../types";
import { processIntentBundle } from "../../../utils/signatures/intent-signatures";
import { getChainIdToWalletClientMap } from "../../../utils/wallet";
import { EVM_NATIVE_TOKEN, USDC } from "../../../utils/constants";
import { CHAIN_IDS } from "../../../utils/chains";

/**
 * Demonstrates a PreHook with Gas Compensation on Polygon without trades — native asset variant.
 *
 * - 0 trades
 * - 1 simple prehook: native MATIC transfer with templated `value: "{amount1}"` placeholder
 * - Gas compensation paid in USDC on Polygon
 *
 * Expected: transfers 1 MATIC on Polygon to DevRel's 2nd address, gas paid in USDC.
 */
async function main() {
  const { privateKey } = getEnvConfig();
  const account = privateKeyToAccount(toHexPrefixString(privateKey));
  const walletClientMap = getChainIdToWalletClientMap(account);

  const senderAddress = account.address;
  const beneficiaryAddress = "0x6098841a6B27feBdb30e51d07c1BD17499efED38"; // DevRel's 2nd address

  const SEND_AMOUNT = "1000000000000000000"; // 1 MATIC (18 decimals)

  const preHook: ExtendedHook = {
    isAtomic: true,
    data: "0x",
    to: beneficiaryAddress,
    value: "{amount1}",
    chainId: CHAIN_IDS.Polygon,
    from: senderAddress,
    placeHolders: [
      {
        nameVariable: "amount1",
        tokenAddress: EVM_NATIVE_TOKEN,
        address: senderAddress,
        additionalAmount: SEND_AMOUNT,
      },
    ],
    gasCompensationInfo: {
      tokenAddress: USDC.Polygon,
      chainId: CHAIN_IDS.Polygon,
      sender: senderAddress,
    },
  };

  console.log("PreHook:", preHook);

  const requestId = randomUUID();
  const requestBody: BundleProposeBody = {
    requestId,
    expirationTimestamp: Math.floor((new Date().getTime() * 2) / 1000),
    enableAccountAbstraction: true,
    isAtomic: true,
    tradingAlgorithm: TradingAlgorithm.MARKET,
    trades: [],
    preHooks: [preHook],
    referralCode: 110000002,
  };

  console.log("Creating bundle...");
  const bundle = await createBundle(requestBody);

  console.log(JSON.stringify(bundle, null, 2));
  console.log("Bundle created successfully!");

  if (bundle.intents && bundle.intents.length > 0) {
    console.log("First intent:", util.inspect(bundle.intents[0], { showHidden: false, depth: null, colors: true }));
  }

  console.log("Collecting signatures for all intents...");
  const signedDataArray = await processIntentBundle(bundle, walletClientMap);
  console.log(`Generated ${signedDataArray.length} signatures for ${bundle.intents?.length || 0} intents`);

  const submitPayload = {
    ...bundle,
    requestId,
    enableAccountAbstraction: true,
    isAtomic: true,
    signedData: signedDataArray,
    referralCode: 110000002,
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
