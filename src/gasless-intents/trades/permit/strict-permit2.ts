/**
 * Swap 2 USDT for USDC on BNB Chain using strictPermit2.
 *
 * npx tsx src/gasless-intents/trades/permit/strict-permit2.ts
 * Loads SIGNER_PK, DE_BRIDGE_PARTNER_API_KEY, and BNB_RPC_URL through dotenv.
 *
 * https://anchorage.debridge.com/bundle/0x6b95b87f132bf4837ecd236a56cf34b556e29a31d2b93b398d38193391379d46
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { createPublicClient, createWalletClient, http, parseUnits, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { bsc } from "viem/chains";
import {
  ApprovalMode, ApproveAmount, SignatureTypes, TradingAlgorithm,
  type BundleProposeBody,
} from "@gasless-intents/types";
import { USDC, USDT } from "@utils/constants";
import { getEvmPrivateKey } from "@utils/env";
import { createBundle, submitBundle } from "@utils/gasless-api";
import { collectRequiredActions } from "@utils/signatures/actions";
import { processIntentBundle } from "@utils/signatures/intent-signatures";
import { toHexPrefixString } from "@utils/string";

async function main() {
  const account = privateKeyToAccount(toHexPrefixString(getEvmPrivateKey()));
  const rpcUrl = process.env.BNB_RPC_URL?.trim();
  if (!rpcUrl) throw new Error("BNB_RPC_URL is required");
  const publicClient = createPublicClient({ chain: bsc, transport: http(rpcUrl) });
  const walletClient = createWalletClient({ account, chain: bsc, transport: http(rpcUrl) });
  if (await publicClient.getChainId() !== bsc.id) throw new Error("BNB_RPC_URL must point to BNB Chain (56)");

  const requestBody: BundleProposeBody = {
    requestId: randomUUID(),
    expirationTimestamp: Math.floor(Date.now() / 1000) + 3600,
    enableAccountAbstraction: false,
    approvalMode: ApprovalMode.StrictPermit2,
    // Bounds the ERC-20 approval. The API's Permit2 typed data may still authorize uint160.max.
    approveAmountFlag: ApproveAmount.ExactApproveAmount,
    isAtomic: true,
    tradingAlgorithm: TradingAlgorithm.MARKET,
    trades: [{
      srcChainId: bsc.id,
      srcChainTokenIn: USDT.BNB,
      srcChainTokenInAmount: parseUnits("2", 18).toString(), // BNB Chain USDT has 18 decimals.
      dstChainId: bsc.id,
      dstChainTokenOut: USDC.BNB,
      dstChainTokenOutAmount: "auto",
      srcChainAuthorityAddress: account.address,
      dstChainAuthorityAddress: account.address,
      dstChainTokenOutRecipient: account.address,
      prependOperatingExpenses: true,
    }],
    preHooks: [],
    postHooks: [],
  };

  console.log(`Proposing BNB Chain USDT -> USDC for ${account.address}`);
  const bundle = await createBundle(requestBody);

  // Broadcast any approval transaction and sign Permit2 + the intent.
  const signedData = await processIntentBundle(bundle, { [bsc.id]: walletClient });

  // The shared handler returns transaction hashes; wait for approval before submission.
  const transactionIds = new Set(collectRequiredActions(bundle)
    .filter(({ action }) => action.type === SignatureTypes.Transaction)
    .map(({ action }) => action.actionId));
  for (const item of signedData) {
    if (!transactionIds.has(item.actionId)) continue;
    const receipt = await publicClient.waitForTransactionReceipt({ hash: item.signedData as Hex });
    if (receipt.status !== "success") throw new Error(`Approval transaction reverted: ${item.signedData}`);
    console.log(`Approval confirmed: ${receipt.transactionHash}`);
  }

  const response = await submitBundle({
    ...bundle,
    requestId: requestBody.requestId,
    enableAccountAbstraction: requestBody.enableAccountAbstraction,
    isAtomic: requestBody.isAtomic,
    signedData,
  });
  console.log("Submit response:", response);
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exitCode = 1;
});
