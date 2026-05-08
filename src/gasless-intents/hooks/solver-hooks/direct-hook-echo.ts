import util from "util";
import { randomUUID } from "crypto";
import { encodeFunctionData, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { toHexPrefixString, getEnvConfig } from "@utils/index";
import { createBundle, submitBundle } from "@utils/api";
import { USDC } from "@utils/constants";
import { CHAIN_IDS } from "@utils/chains";
import { getChainIdToWalletClientMap } from "@utils/wallet";

import {
  BundleProposeBody,
  ExtendedHook,
  HookExecutionType,
  Trade,
  TradingAlgorithm,
} from "../../types";
import { processIntentBundle } from "@utils/signatures/intent-signatures";
import { logActionTypes } from "@utils/logging";

const ECHO_CONTRACT = "0xa77563ce5dfb7fe631d4b9fba8968efbb1f722c8";
const ECHO_ABI = parseAbi(["function echo(string message) external"]);

/**
 * Direct hook calling Echo.echo("Test") with no placeholders.
 *
 * Trade: Base USDC → Polygon USDC, 1.5 USDC source. PreHook on Arbitrum
 * invokes the Echo contract's `echo("Test")` function which emits an
 * `Echoed(sender, "Test")` event. Because the call has no amount argument,
 * `placeHolders` is empty. With `hook.type = direct`, the solver executes the
 * raw transaction itself — the propose response carries a `Transaction` action
 * and no MetaMask gas costs (`SOLVER_EXECUTION_COST` is absent).
 */
async function main() {
  const { privateKey } = getEnvConfig();
  const account = privateKeyToAccount(toHexPrefixString(privateKey));
  const walletClientMap = getChainIdToWalletClientMap(account);
  const sender = account.address;

  const trade: Trade = {
    srcChainId: CHAIN_IDS.Base,
    srcChainTokenIn: USDC.Base,
    srcChainTokenInAmount: "1500000", // 1.5 USDC
    dstChainId: CHAIN_IDS.Polygon,
    dstChainTokenOut: USDC.Polygon,
    dstChainTokenOutAmount: "auto",
    srcChainAuthorityAddress: sender,
    dstChainAuthorityAddress: sender,
    dstChainTokenOutRecipient: sender,
    prependOperatingExpenses: true,
  };

  const callData = encodeFunctionData({
    abi: ECHO_ABI,
    functionName: "echo",
    args: ["Test"],
  });

  const preHook: ExtendedHook = {
    isAtomic: true,
    type: HookExecutionType.Direct,
    data: callData,
    to: ECHO_CONTRACT,
    value: "0",
    chainId: CHAIN_IDS.Base,
    from: sender,
    placeHolders: [],
  };

  console.log("Direct PreHook (echo, no placeholder):", preHook);

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
  const signedDataArray = await processIntentBundle(bundle, walletClientMap);
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

main().catch((error) => {
  console.error("\n🚨 FATAL ERROR in script execution:", error);
  process.exitCode = 1;
});
