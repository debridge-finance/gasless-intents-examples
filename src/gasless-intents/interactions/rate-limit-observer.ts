/**
 * Soft rate-limit demo (Base USDC → Base USDT, same-chain, simple).
 *
 * The pre-interaction encodes `referenceId = 2` — LoggingInteractionHook
 * treats `referenceId > 0` as a SOFT fill-count cap. After two fills of the
 * same intent, the third `PreCallLogged` event would carry
 * `rateLimitExceeded = true`, but `onPreCall` does NOT revert. A hard-cap
 * variant would `require(!exceeded, ...)`. See `hard-cap-rate-limit.ts`.
 */
import { randomUUID } from "crypto";
import { privateKeyToAccount } from "viem/accounts";
import { createBundle, submitBundle } from "@utils/api";
import { processIntentBundle } from "@utils/signatures/intent-signatures";
import { getChainIdToWalletClientMap } from "@utils/wallet";
import { CHAIN_IDS } from "@utils/chains";
import { USDC, USDT } from "@utils/constants";
import { getEnvConfig, toHexPrefixString } from "@utils/index";
import {
  Bundle,
  BundleProposeBody,
  Interaction,
  Trade,
  TradingAlgorithm,
} from "@gasless-intents/types";
import { encodeLogPayload } from "./helpers/log-payload";
import { requireHookAddress } from "./helpers/hook-addresses";

const RATE_LIMIT_CAP = 2n;

async function main(): Promise<Bundle> {
  const { privateKey } = getEnvConfig();
  const account = privateKeyToAccount(toHexPrefixString(privateKey));
  const chainIdToWalletClientMap = getChainIdToWalletClientMap(account);

  const loggingHook = requireHookAddress("LoggingInteractionHook");

  const preInteractions: Interaction[] = [
    {
      hookTarget: loggingHook,
      hookPayload: encodeLogPayload("RateLimit.observer", account.address, RATE_LIMIT_CAP),
    },
  ];
  const postInteractions: Interaction[] = [
    {
      hookTarget: loggingHook,
      hookPayload: encodeLogPayload("RateLimit.post", account.address, RATE_LIMIT_CAP),
    },
  ];

  const trade: Trade = {
    srcChainId: CHAIN_IDS.Base,
    srcChainTokenIn: USDC.Base,
    srcChainTokenInAmount: "1500000", // 1.5 USDC
    dstChainId: CHAIN_IDS.Base,
    dstChainTokenOut: USDT.Base,
    dstChainTokenOutAmount: "auto",
    srcChainAuthorityAddress: account.address,
    dstChainTokenOutRecipient: account.address,
    dstChainAuthorityAddress: account.address,
    prependOperatingExpenses: true,
    preInteractions,
    postInteractions,
  };

  const requestBody: BundleProposeBody = {
    requestId: randomUUID(),
    referralCode: 110000002,
    expirationTimestamp: Math.floor(Date.now() / 1000) + 3600,
    enableAccountAbstraction: true,
    isAtomic: true,
    tradingAlgorithm: TradingAlgorithm.MARKET,
    trades: [trade],
  };

  console.log("Creating bundle...");
  const bundle = await createBundle(requestBody);
  console.log("Bundle created successfully!");

  console.log("Collecting signatures for all intents...");
  const signedDataArray = await processIntentBundle(bundle, chainIdToWalletClientMap);
  console.log(`Generated ${signedDataArray.length} signatures for ${bundle.intents?.length || 0} intents`);

  const submitPayload: Bundle = {
    ...bundle,
    requestId: requestBody.requestId,
    enableAccountAbstraction: true,
    isAtomic: true,
    signedData: signedDataArray,
  };

  const submitResponse = await submitBundle(submitPayload);
  console.log("Submit response:", submitResponse);

  return submitPayload;
}

main().catch((err) => {
  console.error("\n🚨 FATAL ERROR in script execution:", err);
  process.exitCode = 1;
});
