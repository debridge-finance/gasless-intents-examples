/**
 * EOA on-chain intent submission — Arbitrum USDC -> Base USDC, 3.2 USDC.
 *
 * Flow:
 *   1. createBundle (propose)      -> intent JSON (+ intentId) + requiredActions
 *   2. rebuild + verify struct     -> keccak256(abi.encode(struct)) === intentId
 *   3. execute Transaction actions -> ERC-20 approve to AllowanceHolder (+ Wrap if native)
 *   4. submitIntent(struct)        -> full intent on-chain (IntentSubmittedVerbose)
 *   5. verify isIntentSubmitted    -> authoritative on-chain read
 */
import { randomUUID } from "crypto";
import { createWalletClient, createPublicClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrum } from "viem/chains";

import { clipHexPrefix } from "@utils/string";
import { getEnvConfig } from "@utils/env";
import { createBundle } from "@utils/gasless-api";
import { USDC, DE_BRIDGE_CONTRACTS } from "@utils/constants";
import { CHAIN_IDS } from "@utils/chains";
import { IntentManagerAbi } from "@utils/contract-calls/abis";
import { assertIntentIdParity, buildIntentStruct, computeIntentId } from "@utils/intent-struct";
import { executeTransactionActions } from "@utils/bundle/execute-transaction-actions";
import { collectRequiredActions, summarizeRequiredActions } from "@utils/signatures/actions";
import {
  ApprovalMode,
  ApproveAmount,
  BundleProposeBody,
  SignatureTypes,
  TradingAlgorithm,
} from "@gasless-intents/types";

const AMOUNT = "3200000"; // 3.2 USDC (6 decimals)

async function main() {
  const { privateKey } = getEnvConfig();
  const account = privateKeyToAccount(`0x${clipHexPrefix(privateKey)}`);

  const rpc = process.env.ARB_RPC_URL;
  const transport = rpc ? http(rpc) : http();
  const walletClient = createWalletClient({ account, chain: arbitrum, transport });
  const publicClient = createPublicClient({ chain: arbitrum, transport });

  console.log(`EOA: ${account.address}`);
  console.log("Chain: Arbitrum (42161) -> Base (8453), 3.2 USDC\n");

  // 1) Propose (account abstraction DISABLED).
  const requestBody: BundleProposeBody = {
    requestId: randomUUID(),
    expirationTimestamp: Math.floor((Date.now() * 2) / 1000),
    enableAccountAbstraction: false,
    isAtomic: true,
    tradingAlgorithm: TradingAlgorithm.MARKET,
    // Exact-amount ERC-20 approval — never unlimited.
    approvalMode: ApprovalMode.Approve,
    approveAmountFlag: ApproveAmount.ExactApproveAmount,
    trades: [
      {
        srcChainId: CHAIN_IDS.Arbitrum,
        srcChainTokenIn: USDC.Arbitrum,
        srcChainTokenInAmount: AMOUNT,
        dstChainId: CHAIN_IDS.Base,
        dstChainTokenOut: USDC.Base,
        dstChainTokenOutAmount: "auto",
        dstChainTokenOutRecipient: account.address,
        srcChainAuthorityAddress: account.address,
        dstChainAuthorityAddress: account.address,
        prependOperatingExpenses: false
      },
    ],
    preHooks: [],
    postHooks: [],
  };

  console.log("① Proposing bundle (createBundle)...");
  const bundle = await createBundle(requestBody);

  const intentPayload = bundle.intents?.[0];
  if (!intentPayload) throw new Error("Propose returned no intents");
  const intent = intentPayload.intent;
  const intentId = intent.intentId as Hex;
  const requiredActions = intentPayload.requiredActions ?? [];
  console.log(`   intentId:         ${intentId}`);
  console.log(`   intentOwner:      ${intent.intentOwner}`);
  console.log(`   srcAllowedSender: ${JSON.stringify(intent.srcAllowedSender)}`);
  console.log(`   requiredActions:  ${summarizeRequiredActions(collectRequiredActions(bundle)).join("; ")}\n`);

  // 2) Rebuild the full struct from the payload and prove byte-parity with the
  //    API's intentId (== the fill key solvers compute). Refuse to submit on mismatch.
  const intentStruct = buildIntentStruct(intent);
  assertIntentIdParity(intentStruct, intentId);

  console.log(`② Rebuilt struct hashes to the API intentId ✅ (${computeIntentId(intentStruct)})\n`);

  // 3) Execute the Transaction requiredActions (the ERC-20 approve to the
  //    AllowanceHolder; a Wrap tx would appear here for native input).
  //    The Sign712 is skipped — step ④ replaces it with the on-chain submit.
  console.log("③ Executing Transaction requiredAction(s)...");
  
  const executed = await executeTransactionActions(requiredActions, walletClient, publicClient);
  for (const tx of executed) {
    console.log(`   ${tx.actions}: ${tx.hash} (${tx.status})`);
  }

  const skipped = requiredActions.filter((a) => a.type !== SignatureTypes.Transaction);
  if (skipped.length) {
    console.log(
      `   (skipping ${skipped.map((a) => a.type).join(", ")} — the full intent is submitted on-chain instead)`,
    );
  }
  console.log();

  // 4) Submit the FULL intent on-chain (emits IntentSubmittedVerbose with the
  //    entire struct — the event a chain-watching solver needs to fill).
  console.log(`④ submitIntent(fullIntent) -> IntentManager ${DE_BRIDGE_CONTRACTS.EVM.IntentManager}`);
  const submitHash = await walletClient.writeContract({
    address: DE_BRIDGE_CONTRACTS.EVM.IntentManager,
    abi: IntentManagerAbi,
    functionName: "submitIntent",
    args: [intentStruct],
  } as any);
  const submitReceipt = await publicClient.waitForTransactionReceipt({ hash: submitHash });
  console.log(`   ${submitHash} (${submitReceipt.status})\n`);

  // 5) Verify the submission landed on-chain (authoritative signal).
  const submitted = await publicClient.readContract({
    address: DE_BRIDGE_CONTRACTS.EVM.IntentManager,
    abi: IntentManagerAbi,
    functionName: "isIntentSubmitted",
    args: [account.address, intentId],
  } as any);
  console.log(`⑤ isIntentSubmitted(${account.address}, intentId) = ${submitted}`);
  if (!submitted) throw new Error("On-chain submission did not take effect");

  console.log("\nDone — the intent is live for the solver to fill.");
}

main().catch((error) => {
  console.error("\n🚨 FATAL ERROR in script execution:", error);
  process.exitCode = 1;
});
