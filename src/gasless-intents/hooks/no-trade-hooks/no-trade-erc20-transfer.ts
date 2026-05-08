import util from "util";
import { randomUUID } from "crypto";
import { privateKeyToAccount } from "viem/accounts";

import { toHexPrefixString, getEnvConfig } from "../../../utils";
import { createBundle, submitBundle } from "../../../utils/api";
import { BundleProposeBody, ExtendedHook, TradingAlgorithm } from "../../types";
import { processIntentBundle } from "../../../utils/signatures/intent-signatures";
import { getChainIdToWalletClientMap } from "../../../utils/wallet";
import { createTransferCall } from "../../../utils/contract-calls";
import { PLACEHOLDER_TOKEN_AMOUNT, USDC } from "../../../utils/constants";
import { CHAIN_IDS } from "../../../utils/chains";
import { replaceNamedPlaceholders } from "../../../utils/hooks-common";

/**
 * Demonstrates a PreHook with Gas Compensation on Polygon without trades.
 *
 * - 0 trades
 * - 1 simple prehook: ERC-20 transfer of USDC on Polygon with {amount} placeholder
 *
 * Expected: transfers 0.2 USDC on Polygon to Beneficiary.
 */
async function main() {
  const { privateKey } = getEnvConfig();
  const account = privateKeyToAccount(toHexPrefixString(privateKey));
  const walletClientMap = getChainIdToWalletClientMap(account);

  const senderAddress = account.address;
  const beneficiaryAddress = "0x6098841a6B27feBdb30e51d07c1BD17499efED38";

  // Encode ERC-20 transfer with sentinel, then replace with {amount}
  const call = createTransferCall(beneficiaryAddress, BigInt(PLACEHOLDER_TOKEN_AMOUNT));
  call.data = replaceNamedPlaceholders(call.data, ["amount1"]);

  const preHook: ExtendedHook = {
    isAtomic: true,
    data: call.data,
    to: USDC.Polygon, // USDC on Polygon
    value: "0",
    chainId: CHAIN_IDS.Polygon,
    from: senderAddress,
    placeHolders: [
      {
        nameVariable: "amount1",
        tokenAddress: USDC.Polygon,
        address: senderAddress,
        additionalAmount: "200000", // 0.2 USDC (6 decimals)
      },
    ],
    gasCompensationInfo: {
      tokenAddress: USDC.Polygon, // pay gas in USDC
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
