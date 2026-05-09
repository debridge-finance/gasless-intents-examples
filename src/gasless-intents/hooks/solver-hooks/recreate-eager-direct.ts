import { randomUUID } from "crypto";
import { privateKeyToAccount } from "viem/accounts";

import { clipHexPrefix, getEnvConfig } from "@utils/index";
import { createBundle, submitBundle } from "@utils/api";
import { createTransferCall } from "@utils/contract-calls";
import { PLACEHOLDER_TOKEN_AMOUNT, USDC } from "@utils/constants";
import { CHAIN_IDS } from "@utils/chains";
import { getChainIdToWalletClientMap } from "@utils/wallet";
import { replaceNamedPlaceholders } from "@utils/hooks-common";
import { processIntentBundle } from "@utils/signatures/intent-signatures";
import { logActionTypes } from "@utils/logging";

import {
  BundleProposeBody,
  ExtendedHook,
  HookExecutionType,
  PlaceholderResolutionType,
  Trade,
  TradingAlgorithm,
} from "../../types";

import { pollUntilTerminal, writeArtifact } from "./_recreate-helpers";

const SCENARIO = "eager-direct";

/**
 * Recreates verified-examples/prehook eager + direct.json against the live API
 * with the env-derived signer. hook.type=direct, placeholder.type=eager →
 * propose response carries a Transaction action with calldata fully substituted.
 * Saves propose / submit-request / submit-response / fulfillment under
 * verified-recreated/.
 */
async function main() {
  const { privateKey } = getEnvConfig();
  const account = privateKeyToAccount(`0x${clipHexPrefix(privateKey)}`);
  const chainIdToWalletClientMap = getChainIdToWalletClientMap(account);
  const sender = account.address;

  const trade: Trade = {
    srcChainId: CHAIN_IDS.Polygon,
    srcChainTokenIn: USDC.Polygon,
    srcChainTokenInAmount: "100000",
    dstChainId: CHAIN_IDS.Arbitrum,
    dstChainTokenOut: USDC.Arbitrum,
    dstChainTokenOutAmount: "auto",
    srcChainAuthorityAddress: sender,
    dstChainAuthorityAddress: sender,
    dstChainTokenOutRecipient: sender,
    prependOperatingExpenses: true,
  };

  const call = createTransferCall(sender, BigInt(PLACEHOLDER_TOKEN_AMOUNT));
  const callData = replaceNamedPlaceholders(call.data as string, ["amount"]);

  const preHook: ExtendedHook = {
    isAtomic: true,
    type: HookExecutionType.Direct,
    data: callData,
    to: USDC.Polygon,
    value: "0",
    chainId: CHAIN_IDS.Polygon,
    from: sender,
    placeHolders: [
      {
        nameVariable: "amount",
        type: PlaceholderResolutionType.Eager,
        tokenAddress: USDC.Polygon,
        address: sender,
        additionalAmount: "2000000",
      },
    ],
  };

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

  console.log(`[${SCENARIO}] Creating bundle…`);
  const bundle = await createBundle(requestBody);
  writeArtifact(SCENARIO, "propose", bundle);
  logActionTypes(bundle);

  const signedDataArray = await processIntentBundle(bundle, chainIdToWalletClientMap);
  console.log(`[${SCENARIO}] Generated ${signedDataArray.length} signedData items`);

  const submitPayload = {
    ...bundle,
    requestId,
    enableAccountAbstraction: true,
    isAtomic: true,
    signedData: signedDataArray,
    referralCode: 110000002,
  };
  writeArtifact(SCENARIO, "submit-request", submitPayload);

  console.log(`[${SCENARIO}] Submitting…`);
  const submitResponse = await submitBundle(submitPayload);
  writeArtifact(SCENARIO, "submit-response", submitResponse);
  console.log(`[${SCENARIO}] Submit response:`, submitResponse);

  if (!submitResponse.bundleId) {
    console.error(`[${SCENARIO}] No bundleId returned — skipping fulfillment poll`);
    return;
  }

  console.log(`[${SCENARIO}] Polling for fulfillment of ${submitResponse.bundleId}…`);
  const fulfillment = await pollUntilTerminal(submitResponse.bundleId);
  writeArtifact(SCENARIO, "fulfillment", fulfillment);
  console.log(`[${SCENARIO}] Final status: ${(fulfillment as { status?: string }).status}`);
}

main().catch((error) => {
  console.error(`\n🚨 [${SCENARIO}] FATAL ERROR:`, error);
  process.exitCode = 1;
});
