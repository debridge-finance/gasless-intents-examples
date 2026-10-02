import { randomUUID } from "crypto";
import { createPublicClient, createWalletClient, http, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { Bundle, BundleProposeBody, Trade, TradingAlgorithm } from "@gasless-intents/types";
import { CHAIN_IDS, hyperEvm } from "@utils/chains";
import { HYPERCORE, HYPERLIQUID_ENDPOINTS, USDC } from "@utils/constants";
import { getEvmPrivateKey } from "@utils/env";
import { createBundle, submitBundle } from "@utils/gasless-api";
import {
  deriveHyperliquidEscrow,
  verifyHyperliquidWithdrawalForToken,
} from "@utils/hyperliquid-withdrawal";
import { getRequiredActionSignatures } from "@utils/signatures/intent-signatures";
import { toHexPrefixString } from "@utils/string";

async function main() {
  const account = privateKeyToAccount(toHexPrefixString(getEvmPrivateKey()));
  const hyperEvmClient = createPublicClient({ chain: hyperEvm, transport: http() });
  const signingClient = createWalletClient({ account, chain: hyperEvm, transport: http() });

  const trade: Trade = {
    srcChainId: CHAIN_IDS.HyperCore,
    srcChainTokenIn: HYPERCORE.HYPE.address,
    srcChainTokenInAmount: parseUnits("0.01", HYPERCORE.HYPE.evmDecimals).toString(),
    srcChainAuthorityAddress: account.address,
    dstChainId: CHAIN_IDS.Base,
    dstChainTokenOut: USDC.Base,
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

  console.log("Creating HyperCore HYPE -> Base USDC bundle...");
  const bundle = await createBundle(request, HYPERLIQUID_ENDPOINTS);
  console.log(JSON.stringify(bundle, null, 2));

  const escrow = await deriveHyperliquidEscrow(hyperEvmClient, account.address);
  const verified = verifyHyperliquidWithdrawalForToken({
    bundle,
    escrow,
    recipient: account.address,
    destinationToken: USDC.Base,
    token: HYPERCORE.HYPE,
  });
  console.log("Verified withdrawal actions for escrow:", verified.escrow);

  const signedData = await getRequiredActionSignatures(
    verified.intent.requiredActions,
    signingClient,
  );

  const signedIds = new Set(signedData.map((item) => item.actionId));
  if (
    signedData.length !== 2 ||
    !signedIds.has(verified.sendAssetActionId) ||
    !signedIds.has(verified.signedIntentActionId)
  ) {
    throw new Error("Refusing to submit: signatures do not exactly match the verified actions.");
  }

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
