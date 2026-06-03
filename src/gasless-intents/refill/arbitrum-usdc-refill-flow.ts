import "dotenv/config";

import { randomUUID } from "crypto";
import { privateKeyToAccount } from "viem/accounts";

import { ApprovalMode, ApproveAmount, Bundle, BundleProposeBody, TradingAlgorithm } from "@gasless-intents/types";
import { CHAIN_IDS } from "@utils/chains";
import { USDC } from "@utils/constants";
import { createBundle, submitBundle } from "@utils/gasless-api";
import { collectRequiredActions, findBudgetApprovalAction, summarizeRequiredActions } from "@utils/signatures/actions";
import { processIntentBundleActions } from "@utils/signatures/intent-signatures";
import { toHexPrefixString } from "@utils/string";
import { getChainIdToWalletClientMap } from "@utils/wallet";

import {
  broadcastBudgetApproval,
  formatNativeWei,
  getApprovalGasCheck,
  waitForApprovalGas,
} from "./utils";
import { getEnvConfig } from "@utils/env";

const REFERRAL_CODE = 110000002;
const USDC_AMOUNT_RAW = "3000000"; // 3 USDC
const POLL_INTERVAL_MS = 15_000;
const MAX_POLL_ATTEMPTS = 40;

function buildRequestBody(authorityAddress: `0x${string}`): BundleProposeBody {
  return {
    requestId: `refill-arbitrum-usdc-${randomUUID()}`,
    referralCode: REFERRAL_CODE,
    expirationTimestamp: Math.floor(Date.now() / 1000) + 60 * 60,
    enableAccountAbstraction: false,
    approvalMode: ApprovalMode.Approve,
    approveAmountFlag: ApproveAmount.ExactApproveAmount,
    useRefill: true,
    isAtomic: true,
    tradingAlgorithm: TradingAlgorithm.MARKET,
    trades: [
      {
        srcChainId: CHAIN_IDS.Arbitrum,
        srcChainTokenIn: USDC.Arbitrum,
        srcChainTokenInAmount: USDC_AMOUNT_RAW,
        srcChainTokenInMinAmount: USDC_AMOUNT_RAW,
        srcChainTokenInMaxAmount: USDC_AMOUNT_RAW,
        srcChainAuthorityAddress: authorityAddress,
        dstChainId: CHAIN_IDS.Base,
        dstChainTokenOut: USDC.Base,
        dstChainTokenOutAmount: "auto",
        dstChainTokenOutRecipient: authorityAddress,
        dstChainAuthorityAddress: authorityAddress,
        prependOperatingExpenses: true,
      },
    ],
  };
}

function logRequiredActions(lines: string[]): void {
  console.log("Required actions:");
  for (const line of lines) {
    console.log(`- ${line}`);
  }
}

function logApprovalGas(prefix: string, balanceWei: bigint, requiredWei: bigint): void {
  console.log(`${prefix}: ${formatNativeWei(balanceWei)} available, ${formatNativeWei(requiredWei)} required`);
}

async function main() {
  const { privateKey } = getEnvConfig();

  const account = privateKeyToAccount(toHexPrefixString(privateKey));
  const walletClientMap = getChainIdToWalletClientMap(account);

  const requestBody = buildRequestBody(account.address);

  console.log("Gas Refill example: Arbitrum USDC -> Base USDC");
  console.log(`Authority: ${account.address}`);
  console.log(`Amount: ${USDC_AMOUNT_RAW} raw USDC`);

  console.log("Creating proposal...");
  const proposal = await createBundle(requestBody);
  const requiredActions = collectRequiredActions(proposal);
  const budgetApproval = findBudgetApprovalAction(proposal);

  logRequiredActions(summarizeRequiredActions(requiredActions));

  const initialGasCheck = await getApprovalGasCheck(budgetApproval, account.address);
  logApprovalGas("Arbitrum native gas for Budget approval", initialGasCheck.balanceWei, initialGasCheck.requiredWei);

  const signedData = await processIntentBundleActions(proposal, walletClientMap, {}, { skipBudgetApprovalTransactions: true });

  console.log(`Prepared ${signedData.length} signedData ${signedData.length === 1 ? "entry" : "entries"}.`);

  console.log("Submitting original proposal payload with signedData...");
  const submitPayload: Bundle = {
    ...proposal,
    requestId: requestBody.requestId,
    enableAccountAbstraction: true,
    isAtomic: true,
    signedData,
  };
  const submitResponse = await submitBundle(submitPayload);
  console.log(`Bundle submitted: ${submitResponse.bundleId}`);

  let approvalGasCheck = await getApprovalGasCheck(budgetApproval, account.address);
  if (!approvalGasCheck.hasEnough) {
    console.log("Waiting for refill to fund Arbitrum native gas before broadcasting Budget approval...");

    const refilledGasCheck = await waitForApprovalGas({
      approval: budgetApproval,
      authorityAddress: account.address,
      pollIntervalMs: POLL_INTERVAL_MS,
      maxAttempts: MAX_POLL_ATTEMPTS,
      onPoll: (attempt, gasCheck) => {
        console.log(
          `Refill poll ${attempt}/${MAX_POLL_ATTEMPTS}: ${formatNativeWei(gasCheck.balanceWei)} available, ${formatNativeWei(gasCheck.requiredWei)} required`,
        );
      },
    });

    if (!refilledGasCheck) {
      console.log("Budget approval was not broadcast because refill did not fund enough Arbitrum ETH in time.");
      return;
    }

    approvalGasCheck = refilledGasCheck;
  }

  logApprovalGas("Arbitrum native gas after submit/refill", approvalGasCheck.balanceWei, approvalGasCheck.requiredWei);
  console.log("Broadcasting Budget approval...");
  const approvalTxHash = await broadcastBudgetApproval(budgetApproval, walletClientMap);
  console.log(`Budget approval transaction: ${approvalTxHash}`);
}

main().catch((error) => {
  console.error("\nFATAL ERROR in gas refill example:", error);
  process.exitCode = 1;
});
