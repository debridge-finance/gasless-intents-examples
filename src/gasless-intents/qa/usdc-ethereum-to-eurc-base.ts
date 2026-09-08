// Run: npx tsx src/gasless-intents/qa/usdc-ethereum-to-eurc-base.ts
// Propose, sign, and submit a QA simulation of 2.5 USDC; the solver skips broadcasting.
import { randomUUID } from "crypto";
import { CHAIN_IDS } from "@utils/chains";
import { EURC_BASE, USDC } from "@utils/constants";
import { privateKeyToAccount } from "viem/accounts";
import { ApproveAmount, Bundle, BundleProposeBody, TradingAlgorithm } from "@gasless-intents/types";
import { getEnvConfig } from "@utils/env";
import { createBundle, getExplorerBundleById, submitBundle } from "@utils/gasless-api";
import { processIntentBundle } from "@utils/signatures/intent-signatures";
import { toHexPrefixString } from "@utils/string";
import { getChainIdToWalletClientMap } from "@utils/wallet";

async function main() {
  const { privateKey, referralCode } = getEnvConfig();
  const account = privateKeyToAccount(toHexPrefixString(privateKey));
  const wallets = getChainIdToWalletClientMap(account);

  const requestBody: BundleProposeBody = {
    requestId: randomUUID(),
    referralCode,
    expirationTimestamp: Math.floor(Date.now() / 1000) + 20 * 60,
    enableAccountAbstraction: true,
    isAtomic: true,
    approveAmountFlag: ApproveAmount.ExactApproveAmount,
    tradingAlgorithm: TradingAlgorithm.MARKET,
    trades: [{
      srcChainId: CHAIN_IDS.Ethereum,
      srcChainTokenIn: USDC.Ethereum,
      srcChainTokenInAmount: "2500000", // 2.5 USDC (6 decimals)
      dstChainId: CHAIN_IDS.Base,
      dstChainTokenOut: EURC_BASE,
      dstChainTokenOutAmount: "auto",
      prependOperatingExpenses: false,
      srcChainAuthorityAddress: account.address,
      dstChainAuthorityAddress: account.address,
      dstChainTokenOutRecipient: account.address,
    }],
    preHooks: [],
    postHooks: [],
  };

  console.log("Proposing:", JSON.stringify(requestBody, null, 2));
  const bundle = await createBundle(requestBody);
  console.log("Quote:", JSON.stringify({
    trades: bundle.trades,
    inputs: bundle.accumulativeTokenInput,
    outputs: bundle.accumulativeTokenOutput,
    costs: bundle.bundleCosts,
  }, null, 2));

  const signedData = await processIntentBundle(bundle, wallets);
  const submitPayload: Bundle = {
    ...bundle,
    requestId: requestBody.requestId,
    referralCode,
    enableAccountAbstraction: true,
    isAtomic: true,
    isQa: true,
    signedData,
  };
  const response = await submitBundle(submitPayload);
  console.log("Submit response:", JSON.stringify(response));

  // Fetch by ID includes hidden QA bundles; list requests need showHiddenBundles=true.
  const details = await getExplorerBundleById(response.bundleId);
  console.log("Bundle details:", JSON.stringify(details, null, 2));
  // allSimulationsPassed === true confirms QA success; status may remain "created".
  // allSimulationsPassedAt is the success timestamp. Both fields may be absent while pending.
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
