import { randomUUID } from "crypto";
import { encodeFunctionData, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { getEnvConfig } from "@utils/env";
import { clipHexPrefix, toHexPrefixString } from "@utils/string";
import { Erc20Abi } from "@utils/contract-calls/abis";
import { createBundle, submitBundle } from "@utils/gasless-api";
import { CHAIN_IDS } from "@utils/chains";
import { PLACEHOLDER_TOKEN_AMOUNT, USDC } from "@utils/constants";
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

// Scenario: cross-chain trade Base USDC → Arbitrum USDC, then a single
// delegated+deferred postHook on Arbitrum that transfers the bridged USDC
// to a hardcoded beneficiary. Placeholder {transferAmount} is resolved at
// submit to half of the auto-quoted dst amount (32-byte hex). Drives the
// Sign712MetaMaskWithPlaceholders required-action path in intent-signatures.ts.

const SCENARIO = "delegated-deferred-erc-20";

const TRANSFER_PLACEHOLDER_NAME = "transferAmount";

// Bare {nameVariable, type} is the documented delegated+deferred shape — the
// tokenAddress/address fields are eager-only (used for on-chain balance lookup).
const transferPlaceholder: PlaceHolder = {
  nameVariable: TRANSFER_PLACEHOLDER_NAME,
  type: PlaceholderResolutionType.Deferred,
} as PlaceHolder;

// Hardcoded test recipient.
const BENEFICIARY = "0x6098841a6B27feBdb30e51d07c1BD17499efED38" as const;

async function main() {
  const { privateKey } = getEnvConfig();
  const account = privateKeyToAccount(`0x${clipHexPrefix(privateKey)}`);
  const chainIdToWalletClientMap = getChainIdToWalletClientMap(account);
  const operator = account.address;
  const requestId = randomUUID();

  console.log(`[${SCENARIO}] Operator: ${operator}`);

  const trade: Trade = {
    srcChainId: CHAIN_IDS.Base,
    srcChainTokenIn: USDC.Base,
    srcChainTokenInAmount: parseUnits("2.2", 6).toString(),
    dstChainId: CHAIN_IDS.Arbitrum,
    dstChainTokenOut: USDC.Arbitrum,
    dstChainTokenOutAmount: "auto",
    srcChainAuthorityAddress: operator,
    dstChainAuthorityAddress: operator,
    dstChainTokenOutRecipient: operator,
    prependOperatingExpenses: true,
  };

  // PostHook: transfer(BENEFICIARY, {transferAmount}) on Arbitrum, delegated+deferred.
  const transferCalldataConcrete = encodeFunctionData({
    abi: Erc20Abi.Transfer,
    functionName: "transfer",
    args: [toHexPrefixString(BENEFICIARY), BigInt(PLACEHOLDER_TOKEN_AMOUNT)],
  });
  const transferCalldataWithMarker = toHexPrefixString(
    replaceNamedPlaceholders(transferCalldataConcrete, [TRANSFER_PLACEHOLDER_NAME]),
  );
  const transferHook: ExtendedHook = {
    isAtomic: true,
    type: HookExecutionType.Delegated,
    chainId: CHAIN_IDS.Arbitrum,
    from: operator,
    to: toHexPrefixString(USDC.Arbitrum),
    value: "0",
    data: transferCalldataWithMarker,
    placeHolders: [transferPlaceholder],
  };

  console.log(`[${SCENARIO}] transfer calldata template: ${transferCalldataWithMarker}`);
  console.log(`[${SCENARIO}] postHook[0]/transfer`);
  console.log(`  type:         ${transferHook.type}`);
  console.log(`  to:           ${transferHook.to}`);
  console.log(`  placeHolders: ${JSON.stringify(transferHook.placeHolders)}`);
  console.log(`  data:         ${transferHook.data}`);

  const requestBody: BundleProposeBody = {
    requestId,
    referralCode: 110000002,
    expirationTimestamp: Math.floor(Date.now() / 1000) + 3600,
    enableAccountAbstraction: true,
    isAtomic: true,
    tradingAlgorithm: TradingAlgorithm.MARKET,
    trades: [trade],
    preHooks: [],
    postHooks: [transferHook],
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
      console.log(`  - actionId=${action.actionId} type=${action.type} placeholders=${JSON.stringify(placeholders ?? null)}`);
    }
  }

  // Auto-quoted dst amount → halve → 32-byte-padded hex.
  const dstAuto = BigInt((bundle.trades?.[0]?.dstChainTokenOut as { amount?: string } | undefined)?.amount ?? "0");
  if (dstAuto === 0n) {
    throw new Error(`[${SCENARIO}] propose response missing trades[0].dstChainTokenOut.amount — cannot compute half`);
  }
  const half = dstAuto / 2n;
  const halfHex = `0x${half.toString(16).padStart(64, "0")}` as `0x${string}`;
  console.log(`[${SCENARIO}] dst auto-quoted = ${dstAuto} → half = ${half} (0x-padded: ${halfHex})`);

  const providedDataMap = buildHookProvidedDataMap(bundle, {
    [TRANSFER_PLACEHOLDER_NAME]: halfHex,
  });

  const signedDataArray = await processIntentBundle(bundle, chainIdToWalletClientMap, providedDataMap);
  console.log(`[${SCENARIO}] Generated ${signedDataArray.length} signedData items`);
  for (const item of signedDataArray) {
    const sigLen = item.signedData === "0x" ? 0 : (item.signedData.length - 2) / 2;
    console.log(
      `  - actionId=${item.actionId} signedData=${sigLen} bytes providedData=${JSON.stringify(item.providedData ?? null)}`,
    );
  }
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
}

main().catch((error) => {
  console.error(`\n🚨 [${SCENARIO}] FATAL ERROR:`, error);
  process.exitCode = 1;
});
