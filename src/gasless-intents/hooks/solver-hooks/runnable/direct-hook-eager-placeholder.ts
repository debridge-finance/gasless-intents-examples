import util from "util";
import { randomUUID } from "crypto";
import { privateKeyToAccount } from "viem/accounts";

import { toHexPrefixString, getEnvConfig } from "@utils/index";
import { createBundle, submitBundle } from "@utils/api";
import { createTransferCall } from "@utils/contract-calls";
import { PLACEHOLDER_TOKEN_AMOUNT, USDC } from "@utils/constants";
import { CHAIN_IDS } from "@utils/chains";
import { getChainIdToWalletClientMap } from "@utils/wallet";
import { replaceNamedPlaceholders } from "@utils/hooks-common";

import {
  BundleProposeBody,
  ExtendedHook,
  HookExecutionType,
  PlaceholderResolutionType,
  Trade,
  TradingAlgorithm,
} from "../../../types";
import { processIntentBundleWithSolverHooks } from "@utils/signatures/solver-hook-signatures";

/**
 * Direct hook, eager placeholder → Transaction action.
 *
 * Cross-chain trade Arbitrum USDC → Polygon USDC, plus a preHook on Arbitrum
 * that ERC-20-transfers the trade's source amount to the signer (self-transfer).
 * The `{amount1}` placeholder is `eager` (default), so the API substitutes the
 * cumulative trade amount at propose time. Because the hook is `direct`, the
 * solver executes the calldata itself — the propose response carries a
 * `Transaction` action and no MetaMask gas costs (`SOLVER_EXECUTION_COST` is
 * absent from the action's actionCosts).
 */
async function main() {
  const { privateKey } = getEnvConfig();
  const account = privateKeyToAccount(toHexPrefixString(privateKey));
  const walletClientMap = getChainIdToWalletClientMap(account);
  const sender = account.address;

  const trade: Trade = {
    srcChainId: CHAIN_IDS.Arbitrum,
    srcChainTokenIn: USDC.Arbitrum,
    srcChainTokenInAmount: "1500000", // 1.5 USDC
    dstChainId: CHAIN_IDS.Polygon,
    dstChainTokenOut: USDC.Polygon,
    dstChainTokenOutAmount: "auto",
    srcChainAuthorityAddress: sender,
    dstChainAuthorityAddress: sender,
    dstChainTokenOutRecipient: sender,
    prependOperatingExpenses: true,
  };

  const call = createTransferCall(sender, BigInt(PLACEHOLDER_TOKEN_AMOUNT));
  const callData = replaceNamedPlaceholders(call.data as string, ["amount1"]);

  const preHook: ExtendedHook = {
    isAtomic: true,
    type: HookExecutionType.Direct,
    data: callData,
    to: USDC.Arbitrum,
    value: "0",
    chainId: CHAIN_IDS.Arbitrum,
    from: sender,
    placeHolders: [
      {
        nameVariable: "amount1",
        type: PlaceholderResolutionType.Eager,
        tokenAddress: USDC.Arbitrum,
        address: sender,
      },
    ],
  };

  console.log("Direct PreHook (eager placeholder):", preHook);

  const requestId = randomUUID();
  const requestBody: BundleProposeBody = {
    requestId,
    expirationTimestamp: Math.floor((new Date().getTime() * 2) / 1000),
    enableAccountAbstraction: true,
    isAtomic: true,
    tradingAlgorithm: TradingAlgorithm.MARKET,
    trades: [trade],
    preHooks: [preHook],
    referralCode: 110000002,
  };

  console.log("Creating bundle…");
  const bundle = await createBundle(requestBody);
  console.log(JSON.stringify(bundle, null, 2));

  logActionTypes(bundle);

  console.log("Collecting signatures for all intents (direct hook needs none)…");
  const signedDataArray = await processIntentBundleWithSolverHooks(bundle, walletClientMap);
  console.log(`Generated ${signedDataArray.length} signedData items`);

  const submitPayload = {
    ...bundle,
    requestId,
    enableAccountAbstraction: true,
    isAtomic: true,
    signedData: signedDataArray,
    referralCode: 110000002,
  };

  const submitResponse = await submitBundle(submitPayload);
  console.log("Submit response:", util.inspect(submitResponse, { depth: null, colors: true }));

  return submitPayload;
}

function logActionTypes(bundle: Awaited<ReturnType<typeof createBundle>>) {
  const types = [
    ...(bundle.intents ?? []).flatMap((i) => i.requiredActions.map((a) => `intent:${a.type}`)),
    ...(bundle.preHooks ?? []).flatMap((h) => h.requiredActions.map((a) => `preHook:${a.type}`)),
    ...(bundle.postHooks ?? []).flatMap((h) => h.requiredActions.map((a) => `postHook:${a.type}`)),
  ];
  console.log("Required action types:", types);
}

main().catch((error) => {
  console.error("\n🚨 FATAL ERROR in script execution:", error);
  process.exitCode = 1;
});
