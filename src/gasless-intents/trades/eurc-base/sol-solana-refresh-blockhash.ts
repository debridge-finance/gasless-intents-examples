// Run: npx tsx src/gasless-intents/trades/eurc-base/sol-solana-refresh-blockhash.ts
// Demonstrates: propose -> sign -> wait 90s -> deBridge refresh -> sign again -> submit.
import { randomUUID } from "crypto";
import { CHAIN_IDS } from "@utils/chains";
import { setTimeout as delay } from "timers/promises";
import { privateKeyToAccount } from "viem/accounts";
import { Connection, Keypair, VersionedTransaction } from "@solana/web3.js";
import bs58 from "bs58";
import { ApproveAmount, Bundle, BundleProposeBody, SignatureTypes, SolanaSign, TradingAlgorithm } from "@gasless-intents/types";
import { getEnvConfig } from "@utils/env";
import { createBundle, submitBundle } from "@utils/gasless-api";
import { SOLANA_RPC_URL, EURC_BASE, SOL_NATIVE } from "@utils/constants";
import { processIntentBundle } from "@utils/signatures/intent-signatures";
import { refreshSolanaBundleTransactions } from "@utils/solana/refresh-blockhash";
import { clipHexPrefix, toHexPrefixString } from "@utils/string";
import { getChainIdToWalletClientMap } from "@utils/wallet";

async function printBlockhashes(bundle: Bundle, phase: string): Promise<void> {
  const connection = new Connection(process.env.SOL_RPC_URL || SOLANA_RPC_URL, "confirmed");
  for (const item of [...bundle.intents, ...(bundle.preHooks ?? []), ...(bundle.postHooks ?? [])]) {
    for (const action of item.requiredActions ?? []) {
      if (action.type !== SignatureTypes.SignTransaction) continue;
      const transaction = VersionedTransaction.deserialize(Buffer.from(clipHexPrefix((action.data as SolanaSign).data), "hex"));
      const blockhash = transaction.message.recentBlockhash;
      const { value: isValid } = await connection.isBlockhashValid(blockhash);
      console.log(JSON.stringify({ phase, at: new Date().toISOString(), actionId: action.actionId, blockhash, isValid }));
    }
  }
}

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

  const firstSignatures = await processIntentBundle(bundle, wallets);
  console.log(`Collected ${firstSignatures.length} initial signatures at ${new Date().toISOString()}; these will be discarded.`);
  await printBlockhashes(bundle, "initial-signatures-collected");
  const waitStarted = Date.now();
  for (let elapsed = 30; elapsed <= 90; elapsed += 30) {
    await delay(30_000);
    console.log(`Wallet delay: ${elapsed}/90 seconds`);
  }
  console.log(`Waited ${Date.now() - waitStarted}ms after the first signing round.`);
  // 90s does not guarantee expiration: validity depends on block production. Record it explicitly.
  await printBlockhashes(bundle, "before-refresh");
  const refreshed = await refreshSolanaBundleTransactions({ ...bundle, signedData: firstSignatures });
  await printBlockhashes(refreshed, "after-refresh");
  const signedData = await processIntentBundle(refreshed, wallets);
  const submitPayload: Bundle = {
    ...refreshed,
    requestId: requestBody.requestId,
    referralCode,
    enableAccountAbstraction: true,
    isAtomic: true,
    signedData, // Only the second signing round. Never reuse the old signed transaction.
  };
  console.log("Submit response:", JSON.stringify(await submitBundle(submitPayload)));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
