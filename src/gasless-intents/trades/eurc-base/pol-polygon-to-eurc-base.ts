// Run: npx tsx src/gasless-intents/trades/eurc-base/pol-polygon-to-eurc-base.ts
// Propose, sign, and submit a swap of 25 native POL using the accounts in .env.
import { randomUUID } from "crypto";
import { CHAIN_IDS } from "@utils/chains";
import { EURC_BASE, EVM_NATIVE_TOKEN } from "@utils/constants";
import { privateKeyToAccount } from "viem/accounts";
import { ApproveAmount, Bundle, BundleProposeBody, TradingAlgorithm } from "@gasless-intents/types";
import { getEnvConfig } from "@utils/env";
import { createBundle, submitBundle } from "@utils/gasless-api";
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
      srcChainId: CHAIN_IDS.Polygon,
      srcChainTokenIn: EVM_NATIVE_TOKEN,
      srcChainTokenInAmount: "25000000000000000000", // 25 native POL (18 decimals)
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
    signedData,
  };
  const response = await submitBundle(submitPayload);
  // Acceptance is not fulfillment. Track this bundleId using the Explorer.
  console.log("Submit response:", JSON.stringify(response));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
