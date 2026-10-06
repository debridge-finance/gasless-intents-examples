import { randomUUID } from "crypto";
import { privateKeyToAccount } from "viem/accounts";

import { BundleProposeBody, Trade, TradingAlgorithm } from "@gasless-intents/types";
import { CHAIN_IDS } from "@utils/chains";
import { HYPERCORE, HYPERLIQUID_ENDPOINTS, USDC } from "@utils/constants";
import { getEvmPrivateKey } from "@utils/env";
import { createBundle } from "@utils/gasless-api";
import { toHexPrefixString } from "@utils/string";

const ACCOUNT = privateKeyToAccount(toHexPrefixString(getEvmPrivateKey())).address;

async function main() {
  const trade: Trade = {
    srcChainId: CHAIN_IDS.Arbitrum,
    srcChainTokenIn: USDC.Arbitrum,
    srcChainTokenInAmount: "1000000",
    srcChainAuthorityAddress: ACCOUNT,

    dstChainId: CHAIN_IDS.HyperCore,
    dstChainTokenOut: HYPERCORE.USDC.address,
    dstChainTokenOutAmount: "auto",
    dstChainTokenOutRecipient: ACCOUNT,
    dstChainAuthorityAddress: ACCOUNT,

    prependOperatingExpenses: true,
  };

  const request: BundleProposeBody = {
    requestId: randomUUID(),
    referralCode: 110000002,
    expirationTimestamp: Math.floor(Date.now() / 1000) + 3600,
    enableAccountAbstraction: false,
    isAtomic: false,
    tradingAlgorithm: TradingAlgorithm.MARKET,
    costToken: {
      chainId: CHAIN_IDS.Arbitrum,
      tokenAddress: USDC.Arbitrum,
    },
    trades: [trade],
    preHooks: [],
    postHooks: [],
  };

  const bundle = await createBundle(request, HYPERLIQUID_ENDPOINTS);
  console.log(JSON.stringify(bundle, null, 2));
}

main().catch((error) => {
  console.error("\nFATAL ERROR in script execution:", error);
  process.exitCode = 1;
});
