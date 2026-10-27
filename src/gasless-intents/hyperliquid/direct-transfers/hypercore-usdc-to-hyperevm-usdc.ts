import { randomUUID } from "crypto";
import { createWalletClient, http, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { Bundle, BundleProposeBody, Trade, TradingAlgorithm } from "@gasless-intents/types";
import { CHAIN_IDS, hyperEvm } from "@utils/chains";
import { HYPERCORE, HYPERLIQUID_ENDPOINTS } from "@utils/constants";
import { getEvmPrivateKey } from "@utils/env";
import { createBundle, submitBundle } from "@utils/gasless-api";
import { getRequiredActionSignatures } from "@utils/signatures/intent-signatures";
import { toHexPrefixString } from "@utils/string";

const AMOUNT = parseUnits("0.3", HYPERCORE.USDC.evmDecimals);

async function main() {
  const account = privateKeyToAccount(toHexPrefixString(getEvmPrivateKey()));
  const signingClient = createWalletClient({ account, chain: hyperEvm, transport: http() });

  const trade: Trade = {
    srcChainId: CHAIN_IDS.HyperCore,
    srcChainTokenIn: HYPERCORE.USDC.address,
    srcChainTokenInAmount: AMOUNT.toString(),
    srcChainAuthorityAddress: account.address,
    dstChainId: CHAIN_IDS.HyperEVM,
    dstChainTokenOut: HYPERCORE.USDC.address,
    dstChainTokenOutAmount: "auto",
    dstChainTokenOutRecipient: account.address,
    dstChainAuthorityAddress: account.address,
    prependOperatingExpenses: true,
  };

  const request: BundleProposeBody = {
    requestId: randomUUID(),
    referralCode: 110000002,
    expirationTimestamp: Math.floor(Date.now() / 1000) + 3600,
    enableAccountAbstraction: false,
    isAtomic: false,
    tradingAlgorithm: TradingAlgorithm.MARKET,
    trades: [trade],
    preHooks: [],
    postHooks: [],
  };

  console.log("Creating HyperCore USDC -> HyperEVM USDC transfer...");
  const bundle = await createBundle(request, HYPERLIQUID_ENDPOINTS);
  console.log(JSON.stringify(bundle, null, 2));

  const signedData = await getRequiredActionSignatures(bundle.intents[0].requiredActions, signingClient);

  const submitPayload: Bundle = {
    ...bundle,
    requestId: request.requestId,
    enableAccountAbstraction: false,
    isAtomic: false,
    signedData,
  };

  const result = await submitBundle(submitPayload, HYPERLIQUID_ENDPOINTS);
  console.log("Submitted bundle:", result);
}

main().catch((error) => {
  console.error("\nFATAL ERROR in script execution:", error);
  process.exitCode = 1;
});
