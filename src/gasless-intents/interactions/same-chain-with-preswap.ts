/**
 * Same-chain trade with a forced pre-swap (Base WETH → Base USDC).
 *
 * Demonstrates pre/postInteractions targeting THREE hook contracts in one trade:
 *   - LoggingInteractionHook (pre + post)
 *   - FillCounter            (post)
 *   - ProtocolFeeRecorder    (post — same-chain-with-preswap is its only path)
 */
import { randomUUID } from "crypto";
import { privateKeyToAccount } from "viem/accounts";
import { createBundle, submitBundle } from "@utils/api";
import { processIntentBundle } from "@utils/signatures/intent-signatures";
import { getChainIdToWalletClientMap } from "@utils/wallet";
import { CHAIN_IDS } from "@utils/chains";
import { USDC } from "@utils/constants";
import { getEnvConfig, toHexPrefixString } from "@utils/index";
import {
  Bundle,
  BundleProposeBody,
  Interaction,
  Trade,
  TradingAlgorithm,
} from "@gasless-intents/types";
import {
  encodeLogPayload,
  encodeSubjectPayload,
} from "./helpers/log-payload";
import { requireHookAddress } from "./helpers/hook-addresses";

// Canonical Base WETH (`0x4200…0006`). Not in @utils/constants.WETH because
// WETH there only covers Ethereum/Polygon/Arbitrum.
const WETH_BASE = "0x4200000000000000000000000000000000000006";

async function main(): Promise<Bundle> {
  const { privateKey } = getEnvConfig();
  const account = privateKeyToAccount(toHexPrefixString(privateKey));
  const chainIdToWalletClientMap = getChainIdToWalletClientMap(account);

  const loggingHook = requireHookAddress("LoggingInteractionHook");
  const fillCounter = requireHookAddress("FillCounter");
  const feeRecorder = requireHookAddress("ProtocolFeeRecorder");

  const preInteractions: Interaction[] = [
    {
      hookTarget: loggingHook,
      hookPayload: encodeLogPayload("SameChainPreSwap.pre", account.address, 0n),
    },
  ];
  const postInteractions: Interaction[] = [
    {
      hookTarget: loggingHook,
      hookPayload: encodeLogPayload("SameChainPreSwap.post", account.address, 100n),
    },
    {
      hookTarget: fillCounter,
      hookPayload: encodeSubjectPayload(account.address),
    },
    {
      hookTarget: feeRecorder,
      hookPayload: encodeSubjectPayload(account.address),
    },
  ];

  const trade: Trade = {
    srcChainId: CHAIN_IDS.Base,
    srcChainTokenIn: WETH_BASE,
    srcChainTokenInAmount: "500000000000000", // 0.0005 WETH
    dstChainId: CHAIN_IDS.Base,
    dstChainTokenOut: USDC.Base,
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
