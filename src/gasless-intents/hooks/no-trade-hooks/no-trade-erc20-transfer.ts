import { randomUUID } from "crypto";
import { privateKeyToAccount } from "viem/accounts";

import { toHexPrefixString } from "@utils/string";
import { getEnvConfig } from "@utils/env";
import { createBundle, submitBundle } from "@utils/gasless-api";
import { BundleProposeBody, GasCompensationInfo, TradingAlgorithm } from "@gasless-intents/types";
import { processIntentBundle } from "@utils/signatures/intent-signatures";
import { getChainIdToWalletClientMap } from "@utils/wallet";
import { CHAIN_IDS } from "@utils/chains";
import { getTransferHook } from "@utils/hooks/erc20-hooks";
import { USDC } from "@utils/constants";

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

  const transferAmount = "200000"; // 0.2 USDC (6 decimals)

  const gasCompensationInfo: GasCompensationInfo = {
    tokenAddress: USDC.Polygon, // pay gas in USDC
    chainId: CHAIN_IDS.Polygon,
    sender: senderAddress,
  };

  const transferHook = getTransferHook(
    account.address,
    beneficiaryAddress,
    USDC.Polygon,
    CHAIN_IDS.Polygon,
    transferAmount,
    gasCompensationInfo,
  );

  console.log("PreHook:", transferHook);

  const requestId = randomUUID();
  const requestBody: BundleProposeBody = {
    requestId,
    expirationTimestamp: Math.floor((new Date().getTime() * 2) / 1000),
    enableAccountAbstraction: true,
    isAtomic: true,
    tradingAlgorithm: TradingAlgorithm.MARKET,
    trades: [],
    preHooks: [transferHook],
    referralCode: 110000002,
  };

  console.log("Creating bundle...");
  const bundle = await createBundle(requestBody);

  console.log(JSON.stringify(bundle, null, 2));
  console.log("Bundle created successfully!");

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
