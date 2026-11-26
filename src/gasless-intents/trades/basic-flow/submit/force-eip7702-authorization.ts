/**
 * Swap 2 USDT for USDC on BNB Chain with a fresh EIP-7702 authorization.
 *
 * npx tsx src/gasless-intents/trades/basic-flow/submit/force-eip7702-authorization.ts
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { createWalletClient, http, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { bsc } from "viem/chains";
import {
  ApprovalMode, ApproveAmount, TradingAlgorithm, type BundleProposeBody,
} from "@gasless-intents/types";
import { USDC, USDT } from "@utils/constants";
import { getEvmPrivateKey } from "@utils/env";
import { createBundle, submitBundle } from "@utils/gasless-api";
import { processIntentBundle } from "@utils/signatures/intent-signatures";
import { toHexPrefixString } from "@utils/string";

async function main() {
  const account = privateKeyToAccount(toHexPrefixString(getEvmPrivateKey()));
  const rpcUrl = process.env.BNB_RPC_URL?.trim();
  if (!rpcUrl) throw new Error("BNB_RPC_URL is required");
  const walletClient = createWalletClient({ account, chain: bsc, transport: http(rpcUrl) });

  const requestBody: BundleProposeBody = {
    requestId: randomUUID(),
    expirationTimestamp: Math.floor(Date.now() / 1000) + 3600,
    enableAccountAbstraction: true,
    // Include authorization even if the owner already delegates to the supported contract.
    forceEip7702Authorization: true,
    approvalMode: ApprovalMode.Approve,
    approveAmountFlag: ApproveAmount.ExactApproveAmount,
    isAtomic: true,
    tradingAlgorithm: TradingAlgorithm.MARKET,
    trades: [{
      srcChainId: bsc.id,
      srcChainTokenIn: USDT.BNB,
      srcChainTokenInAmount: parseUnits("2", 18).toString(),
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
  const signedData = await processIntentBundle(bundle, { [bsc.id]: walletClient });

  const response = await submitBundle({
    ...bundle,
    requestId: requestBody.requestId,
    enableAccountAbstraction: requestBody.enableAccountAbstraction,
    isAtomic: requestBody.isAtomic,
    signedData,
  });
  console.log("Submit response", response);
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exitCode = 1;
});
