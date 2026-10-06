import { randomUUID } from "crypto";
import bs58 from "bs58";
import { Keypair } from "@solana/web3.js";
import { parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { Bundle, BundleProposeBody, Trade, TradingAlgorithm } from "@gasless-intents/types";
import { CHAIN_IDS } from "@utils/chains";
import { HYPERCORE, HYPERLIQUID_ENDPOINTS, USDC } from "@utils/constants";
import {
  getEvmPrivateKey,
  getSolanaPrivateKey,
} from "@utils/env";
import { createBundle, submitBundle } from "@utils/gasless-api";
import { processIntentBundleActions } from "@utils/signatures/intent-signatures";
import { toHexPrefixString } from "@utils/string";
import { getChainIdToWalletClientMap } from "@utils/wallet";

async function main() {
  const evmAccount = privateKeyToAccount(toHexPrefixString(getEvmPrivateKey()));
  const solanaAccount = Keypair.fromSecretKey(bs58.decode(getSolanaPrivateKey()));
  const solanaAddress = solanaAccount.publicKey.toBase58();
  const walletClients = getChainIdToWalletClientMap(evmAccount, solanaAccount);

  const trade: Trade = {
    srcChainId: CHAIN_IDS.Solana,
    srcChainTokenIn: USDC.Solana,
    srcChainTokenInAmount: parseUnits("1", 6).toString(),
    srcChainAuthorityAddress: solanaAddress,
    dstChainId: CHAIN_IDS.HyperCore,
    dstChainTokenOut: HYPERCORE.USDC.address,
    dstChainTokenOutAmount: "auto",
    dstChainTokenOutRecipient: evmAccount.address,
    dstChainAuthorityAddress: evmAccount.address,
    prependOperatingExpenses: true,
  };

  const request: BundleProposeBody = {
    requestId: randomUUID(),
    userId: solanaAddress,
    referralCode: 110000002,
    expirationTimestamp: Math.floor(Date.now() / 1000) + 3600,
    enableAccountAbstraction: true,
    isAtomic: false,
    tradingAlgorithm: TradingAlgorithm.MARKET,
    costToken: { chainId: CHAIN_IDS.Solana, tokenAddress: USDC.Solana },
    trades: [trade],
    preHooks: [],
    postHooks: [],
  };

  console.log("Creating Solana USDC -> HyperCore USDC bundle...");
  const bundle = await createBundle(request, HYPERLIQUID_ENDPOINTS);
  console.log(JSON.stringify(bundle, null, 2));

  const signedData = await processIntentBundleActions(bundle, walletClients, {}, {
    solanaSignMessageEncoding: "utf8",
  });

  const submitPayload: Bundle = {
    ...bundle,
    requestId: request.requestId,
    enableAccountAbstraction: true,
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
