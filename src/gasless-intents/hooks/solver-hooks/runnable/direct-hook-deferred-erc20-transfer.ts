import util from "util";
import { randomUUID } from "crypto";
import { padHex, toHex } from "viem";
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
  SignatureTypes,
  Trade,
  TradingAlgorithm,
} from "../../../types";
import {
  ProvidedDataMap,
  processIntentBundleWithSolverHooks,
} from "@utils/signatures/solver-hook-signatures";

/**
 * Direct hook, deferred placeholder → ProvidePlaceholders action.
 *
 * Cross-chain trade Arbitrum USDC → Polygon USDC, plus a preHook on Arbitrum
 * that ERC-20-transfers a deferred amount of USDC to the signer (self-transfer).
 * The `{amount1}` placeholder is `deferred` and the hook is `direct`: no signature
 * is required for the hook (the solver executes the raw transaction), but the
 * client must supply the hex value via `providedData` at submit time. The
 * propose response carries a `ProvidePlaceholders` action with `signedData = "0x"`
 * for the hook entry.
 */
async function main() {
  const { privateKey } = getEnvConfig();
  const account = privateKeyToAccount(toHexPrefixString(privateKey));
  const walletClientMap = getChainIdToWalletClientMap(account);
  const sender = account.address;
  const additionalAmount = 100_000n; // 0.1 USDC offset added on top of cumulative

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
        type: PlaceholderResolutionType.Deferred,
        tokenAddress: USDC.Arbitrum,
        address: sender,
        additionalAmount: additionalAmount.toString(),
      },
    ],
  };

  console.log("Direct PreHook (deferred placeholder):", preHook);

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

  const providedDataMap = buildProvidedDataMap(bundle, additionalAmount);
  console.log("providedDataMap:", util.inspect(providedDataMap, { depth: null, colors: true }));

  console.log("Collecting signatures for intents and provided data for the direct hook…");
  const signedDataArray = await processIntentBundleWithSolverHooks(
    bundle,
    walletClientMap,
    providedDataMap,
  );
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

function buildProvidedDataMap(
  bundle: Awaited<ReturnType<typeof createBundle>>,
  amount: bigint,
): ProvidedDataMap {
  const amountHex = padHex(toHex(amount), { size: 32 });
  const map: ProvidedDataMap = {};
  const hookBuckets = [...(bundle.preHooks ?? []), ...(bundle.postHooks ?? [])];
  for (const hook of hookBuckets) {
    for (const action of hook.requiredActions) {
      if (action.type === SignatureTypes.ProvidePlaceholders) {
        const data = action.data as { placeholders: Array<{ nameVariable: string }> };
        map[action.actionId] = {};
        for (const ph of data.placeholders) {
          map[action.actionId][ph.nameVariable] = amountHex;
        }
      }
    }
  }
  return map;
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
