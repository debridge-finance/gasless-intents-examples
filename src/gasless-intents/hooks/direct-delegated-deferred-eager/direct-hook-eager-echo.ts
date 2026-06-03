import { randomUUID } from "crypto";
import { encodeFunctionData, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { getEnvConfig } from "@utils/env";
import { toHexPrefixString } from "@utils/string";
import { createBundle, submitBundle } from "@utils/gasless-api";
import { ECHO_BASE, USDC, USDT } from "@utils/constants";
import { CHAIN_IDS } from "@utils/chains";
import { EchoAbi } from "@utils/contract-calls/abis";
import { getChainIdToWalletClientMap } from "@utils/wallet";
import { processIntentBundle } from "@utils/signatures/intent-signatures";
import { logActionTypes } from "@utils/logging";

import {
  BundleProposeBody,
  ExtendedHook,
  HookExecutionType,
  PlaceHolder,
  Trade,
  TradingAlgorithm,
} from "@gasless-intents/types";

const SCENARIO = "direct-eager-echo-usdt-amount";

async function main() {
  const { privateKey } = getEnvConfig();
  const account = privateKeyToAccount(toHexPrefixString(privateKey));
  const walletClientMap = getChainIdToWalletClientMap(account);
  const sender = account.address;
  const requestId = randomUUID();

  console.log(`[${SCENARIO}] Operator: ${sender}`);

  // Trade: 0.5 USDC on Arbitrum → auto USDT on Base.
  const trade: Trade = {
    srcChainId: CHAIN_IDS.Arbitrum,
    srcChainTokenIn: USDC.Arbitrum,
    srcChainTokenInAmount: parseUnits("0.5", 6).toString(),
    dstChainId: CHAIN_IDS.Base,
    dstChainTokenOut: USDT.Base,
    dstChainTokenOutAmount: "auto",
    srcChainAuthorityAddress: sender,
    dstChainAuthorityAddress: sender,
    dstChainTokenOutRecipient: sender,
    prependOperatingExpenses: true,
  };

  const usdtAmountPlaceholder: PlaceHolder = {
    nameVariable: "usdtAmount",
    tokenAddress: USDT.Base,
    address: sender,
  };

  // echo() takes `string`. Reserve a 32-byte slot in the string data so the
  // API's 32-byte uint256 substitution lands cleanly: encode with a 32-char
  // sentinel ('@' = 0x40), then patch its hex with the {usdtAmount} marker.
  const callData = encodeFunctionData({
    abi: EchoAbi.Echo,
    functionName: "echo",
    args: ["@".repeat(32)],
  }).replace("40".repeat(32), `{${usdtAmountPlaceholder.nameVariable}}`) as `0x${string}`;

  // Hand-crafted echo(string) calldata template:
  //   - selector          f15da729
  //   - offset (=32)      0x...0020  (64 hex chars)
  //   - length (=32)      0x...0020  (64 hex chars)
  //   - data placeholder  {usdtAmount}  (API substitutes with 32 bytes = 64 hex chars)
  // const calldata = "0xf15da72900000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000020{usdtAmount}" as `0x${string}`;

  // console.log(callData === calldata)
  // console.log(callData.length === calldata.length)

  const postHook: ExtendedHook = {
    isAtomic: true,
    type: HookExecutionType.Direct,
    chainId: CHAIN_IDS.Base,
    from: sender,
    to: ECHO_BASE,
    value: "0",
    data: callData,
    placeHolders: [usdtAmountPlaceholder],
  };

  const bodyChars = callData.length - 2;
  const projectedSubChars = bodyChars - "{usdtAmount}".length + 64;
  console.log(`[${SCENARIO}] postHook calldata template (pre-propose): ${callData}`);
  console.log(`[${SCENARIO}] template body length: ${bodyChars} hex chars (post-substitution would be ${projectedSubChars}; correct shape = 200)`);
  console.log(`[${SCENARIO}] placeholder: ${JSON.stringify(usdtAmountPlaceholder)}`);

  const requestBody: BundleProposeBody = {
    requestId,
    referralCode: 110000002,
    expirationTimestamp: Math.floor(Date.now() / 1000) + 3600,
    enableAccountAbstraction: true,
    isAtomic: true,
    tradingAlgorithm: TradingAlgorithm.MARKET,
    trades: [trade],
    preHooks: [],
    postHooks: [postHook],
  };

  console.log(`[${SCENARIO}] Creating bundle…`);
  const bundle = await createBundle(requestBody);
  logActionTypes(bundle);

  const resolvedPostHookData = (bundle.postHooks?.[0] as { hook?: { data?: string } } | undefined)?.hook?.data;
  console.log(`[${SCENARIO}] postHook.data after propose (eager-substituted): ${resolvedPostHookData}`);

  const signedDataArray = await processIntentBundle(bundle, walletClientMap);
  console.log(`[${SCENARIO}] Generated ${signedDataArray.length} signedData items`);
  for (const item of signedDataArray) {
    const sigLen = item.signedData === "0x" ? 0 : (item.signedData.length - 2) / 2;
    console.log(`  - actionId=${item.actionId} signedData=${sigLen} bytes`);
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
