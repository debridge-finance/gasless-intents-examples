import { randomUUID } from "crypto";
import { encodeFunctionData, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { getEnvConfig } from "@utils/env";
import { clipHexPrefix, toHexPrefixString } from "@utils/string";
import { AaveV3Abi, Erc20Abi } from "@utils/contract-calls/abis";
import { createBundle, submitBundle } from "@utils/gasless-api";
import { CHAIN_IDS } from "@utils/chains";
import { AAVE_V3_POOL_ARBITRUM, PLACEHOLDER_TOKEN_AMOUNT, USDC } from "@utils/constants";
import { replaceNamedPlaceholders } from "@utils/hooks-common";
import { logActionTypes } from "@utils/logging";
import { buildHookProvidedDataMap, processIntentBundle } from "@utils/signatures/intent-signatures";
import { getChainIdToWalletClientMap } from "@utils/wallet";

import {
  BundleProposeBody,
  ExtendedHook,
  HookExecutionType,
  PlaceHolder,
  PlaceholderResolutionType,
  Trade,
  TradingAlgorithm,
} from "@gasless-intents/types";

const SCENARIO = "another-delegated-deferred-distinct";

const APPROVE_PLACEHOLDER_NAME = "approveAmount";
const SUPPLY_PLACEHOLDER_NAME = "supplyAmount";

const approvePlaceholder: PlaceHolder = {
  nameVariable: APPROVE_PLACEHOLDER_NAME,
  type: PlaceholderResolutionType.Deferred,
} as PlaceHolder;
const supplyPlaceholder: PlaceHolder = {
  nameVariable: SUPPLY_PLACEHOLDER_NAME,
  type: PlaceholderResolutionType.Deferred,
} as PlaceHolder;

async function main() {
  const { privateKey } = getEnvConfig();
  const account = privateKeyToAccount(`0x${clipHexPrefix(privateKey)}`);
  const chainIdToWalletClientMap = getChainIdToWalletClientMap(account);
  const operator = account.address;
  const requestId = randomUUID();

  console.log(`[${SCENARIO}] Operator: ${operator}`);

  const trade: Trade = {
    srcChainId: CHAIN_IDS.Polygon,
    srcChainTokenIn: USDC.Polygon,
    srcChainTokenInAmount: parseUnits("2.2", 6).toString(),
    dstChainId: CHAIN_IDS.Arbitrum,
    dstChainTokenOut: USDC.Arbitrum,
    dstChainTokenOutAmount: "auto",
    srcChainAuthorityAddress: operator,
    dstChainAuthorityAddress: operator,
    dstChainTokenOutRecipient: operator,
    prependOperatingExpenses: true,
  };

  // PostHook 1: approve(AAVE_POOL, {approveAmount}) on Arbitrum, delegated+deferred.
  const approveCalldataConcrete = encodeFunctionData({
    abi: Erc20Abi.Approve,
    functionName: "approve",
    args: [toHexPrefixString(AAVE_V3_POOL_ARBITRUM), BigInt(PLACEHOLDER_TOKEN_AMOUNT)],
  });
  const approveCalldataWithMarker = toHexPrefixString(
    replaceNamedPlaceholders(approveCalldataConcrete, [APPROVE_PLACEHOLDER_NAME]),
  );
  const approveHook: ExtendedHook = {
    isAtomic: true,
    type: HookExecutionType.Delegated,
    chainId: CHAIN_IDS.Arbitrum,
    from: operator,
    to: toHexPrefixString(USDC.Arbitrum),
    value: "0",
    data: approveCalldataWithMarker,
    placeHolders: [approvePlaceholder],
  };

  // PostHook 2: supply(USDC, {supplyAmount}, operator, 0) on Arbitrum, delegated+deferred.
  const supplyCalldataConcrete = encodeFunctionData({
    abi: AaveV3Abi.Supply,
    functionName: "supply",
    args: [
      toHexPrefixString(USDC.Arbitrum),
      BigInt(PLACEHOLDER_TOKEN_AMOUNT),
      operator,
      0,
    ],
  });
  const supplyCalldataWithMarker = toHexPrefixString(
    replaceNamedPlaceholders(supplyCalldataConcrete, [SUPPLY_PLACEHOLDER_NAME]),
  );
  const supplyHook: ExtendedHook = {
    isAtomic: true,
    type: HookExecutionType.Delegated,
    chainId: CHAIN_IDS.Arbitrum,
    from: operator,
    to: toHexPrefixString(AAVE_V3_POOL_ARBITRUM),
    value: "0",
    data: supplyCalldataWithMarker,
    placeHolders: [supplyPlaceholder],
  };

  for (const [label, hook] of [
    ["postHook[0]/approve", approveHook] as const,
    ["postHook[1]/supply", supplyHook] as const,
  ]) {
    console.log(`[${SCENARIO}] ${label}`);
    console.log(`  type:         ${hook.type}`);
    console.log(`  to:           ${hook.to}`);
    console.log(`  placeHolders: ${JSON.stringify(hook.placeHolders)}`);
    console.log(`  data:         ${hook.data}`);
  }

  const requestBody: BundleProposeBody = {
    requestId,
    referralCode: 110000002,
    expirationTimestamp: Math.floor(Date.now() / 1000) + 3600,
    enableAccountAbstraction: true,
    isAtomic: true,
    tradingAlgorithm: TradingAlgorithm.MARKET,
    trades: [trade],
    preHooks: [],
    postHooks: [approveHook, supplyHook],
  };

  console.log(`[${SCENARIO}] Creating bundle…`);
  const bundle = await createBundle(requestBody);
  logActionTypes(bundle);

  const hooksWithLabel = [
    ...(bundle.preHooks ?? []).map((h, i) => [`preHook[${i}]`, h] as const),
    ...(bundle.postHooks ?? []).map((h, i) => [`postHook[${i}]`, h] as const),
  ];
  for (const [label, hookEntry] of hooksWithLabel) {
    const hookTo = (hookEntry as { hook?: { to?: string } }).hook?.to;
    console.log(`[${SCENARIO}] ${label} (to=${hookTo}) requiredActions:`);
    for (const action of hookEntry.requiredActions ?? []) {
      const placeholders = (action.data as { placeholders?: { nameVariable: string }[] }).placeholders;
      console.log(
        `  - actionId=${action.actionId} type=${action.type} placeholders=${JSON.stringify(placeholders ?? null)}`,
      );
    }
  }

  // Auto-quoted dst amount → halve → 32-byte-padded hex.
  const dstAuto = BigInt(
    (bundle.trades?.[0]?.dstChainTokenOut as { amount?: string } | undefined)?.amount ?? "0",
  );
  if (dstAuto === 0n) {
    throw new Error(
      `[${SCENARIO}] propose response missing trades[0].dstChainTokenOut.amount — cannot compute half`,
    );
  }
  const half = dstAuto / 2n;
  const halfHex = (`0x${half.toString(16).padStart(64, "0")}`) as `0x${string}`;
  console.log(
    `[${SCENARIO}] dst auto-quoted = ${dstAuto} → half = ${half} (0x-padded: ${halfHex})`,
  );

  const providedDataMap = buildHookProvidedDataMap(bundle, {
    [APPROVE_PLACEHOLDER_NAME]: halfHex,
    [SUPPLY_PLACEHOLDER_NAME]: halfHex,
  });

  const signedDataArray = await processIntentBundle(
    bundle,
    chainIdToWalletClientMap,
    providedDataMap,
  );

  const submitPayload = {
    ...bundle,
    requestId,
    referralCode: 110000002,
    enableAccountAbstraction: true,
    isAtomic: true,
    signedData: signedDataArray,
  };

  let submitResponse: unknown;
  try {
    submitResponse = await submitBundle(submitPayload);
  } catch (e) {
    submitResponse = { error: e instanceof Error ? e.message : String(e) };
  }
  console.log(`[${SCENARIO}] Submit response:`, submitResponse);

  const bundleId = (submitResponse as { bundleId?: string }).bundleId;
  if (!bundleId) {
    const errMsg = (submitResponse as { error?: string }).error ?? "";
    console.error(`[${SCENARIO}] ❌ No bundleId returned — submit failed: ${errMsg}`);
    process.exitCode = 1;
    return;
  }
  console.log(`[${SCENARIO}] bundleId: ${bundleId}`);

  console.log(`[${SCENARIO}] Polling for fulfillment of ${bundleId}…`);
}

main().catch((error) => {
  console.error(`\n🚨 [${SCENARIO}] FATAL ERROR:`, error);
  process.exitCode = 1;
});
