import { randomUUID } from "crypto";
import { getAddress, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { Bundle, BundleProposeBody, Trade, TradingAlgorithm } from "@gasless-intents/types";
import { CHAIN_IDS } from "@utils/chains";
import { HYPERCORE, HYPERLIQUID_ENDPOINTS, USDC } from "@utils/constants";
import { getEvmPrivateKey } from "@utils/env";
import { createBundle, submitBundle } from "@utils/gasless-api";
import { processIntentBundleActions } from "@utils/signatures/intent-signatures";
import { toHexPrefixString } from "@utils/string";
import { getChainIdToWalletClientMap } from "@utils/wallet";

async function main() {
  const account = privateKeyToAccount(toHexPrefixString(getEvmPrivateKey()));
  const walletClients = getChainIdToWalletClientMap(account);

  const trade: Trade = {
    srcChainId: CHAIN_IDS.Arbitrum,
    srcChainTokenIn: USDC.Arbitrum,
    srcChainTokenInAmount: parseUnits("2", 6).toString(),
    srcChainAuthorityAddress: account.address,
    dstChainId: CHAIN_IDS.HyperCore,
    dstChainTokenOut: HYPERCORE.HYPE.address,
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
    costToken: { chainId: CHAIN_IDS.Arbitrum, tokenAddress: USDC.Arbitrum },
    trades: [trade],
    preHooks: [],
    postHooks: [],
  };

  console.log("Creating Arbitrum USDC -> HyperCore HYPE bundle...");
  const bundle = await createBundle(request, HYPERLIQUID_ENDPOINTS);
  console.log(JSON.stringify(bundle, null, 2));

  const intent = bundle.intents[0].intent;
  const takeToken = intent.takeToken[0];
  const receiver = intent.receiverDetails[0];
  const tokenOut = bundle.trades[0].dstChainTokenOut;
  console.log(
    `Intent delivers ${tokenOut.symbol} (${takeToken.takeTokenAddress} on chain ${takeToken.takeTokenChainId}) ` +
    `to ${receiver.address} on chain(s) ${receiver.destinationChainIds.join(", ")}`,
  );
  if (tokenOut.symbol !== HYPERCORE.HYPE.symbol || getAddress(receiver.address) !== getAddress(account.address)) {
    throw new Error("Refusing to sign: the intent does not deliver HYPE to this account.");
  }

  const signedData = await processIntentBundleActions(bundle, walletClients);

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
