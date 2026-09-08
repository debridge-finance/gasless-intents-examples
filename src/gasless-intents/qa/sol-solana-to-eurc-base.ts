// Run: npx tsx src/gasless-intents/qa/sol-solana-to-eurc-base.ts
// Propose, sign, and submit a QA simulation of 0.025 native SOL; the solver skips broadcasting.
import { randomUUID } from "crypto";
import { CHAIN_IDS } from "@utils/chains";
import { EURC_BASE, SOL_NATIVE } from "@utils/constants";
import { privateKeyToAccount } from "viem/accounts";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { ApproveAmount, Bundle, BundleProposeBody, TradingAlgorithm } from "@gasless-intents/types";
import { getEnvConfig } from "@utils/env";
import { createBundle, getExplorerBundleById, submitBundle } from "@utils/gasless-api";
import { processIntentBundle } from "@utils/signatures/intent-signatures";
import { toHexPrefixString } from "@utils/string";
import { getChainIdToWalletClientMap } from "@utils/wallet";

async function main() {
  const { privateKey, solPrivateKey, referralCode } = getEnvConfig();
  const account = privateKeyToAccount(toHexPrefixString(privateKey));
  const solanaAccount = Keypair.fromSecretKey(bs58.decode(solPrivateKey));
  const wallets = getChainIdToWalletClientMap(account, solanaAccount);

  const requestBody: BundleProposeBody = {
    requestId: randomUUID(),
    referralCode,
    expirationTimestamp: Math.floor(Date.now() / 1000) + 20 * 60,
    enableAccountAbstraction: true,
    isAtomic: true,
    approveAmountFlag: ApproveAmount.ExactApproveAmount,
    tradingAlgorithm: TradingAlgorithm.MARKET,
    trades: [{
      srcChainId: CHAIN_IDS.Solana,
      srcChainTokenIn: SOL_NATIVE,
      srcChainTokenInAmount: "25000000", // 0.025 native SOL (9 decimals)
      dstChainId: CHAIN_IDS.Base,
      dstChainTokenOut: EURC_BASE,
      dstChainTokenOutAmount: "auto",
      prependOperatingExpenses: false,
      srcChainAuthorityAddress: solanaAccount.publicKey.toBase58(),
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
