import { randomUUID } from "crypto";
import { createPublicClient, createWalletClient, http, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { Bundle, BundleProposeBody, SignedDataItem, Trade, TradingAlgorithm, Tx } from "@gasless-intents/types";
import { CHAIN_IDS, hyperEvm } from "@utils/chains";
import { HYPERCORE, HYPERLIQUID_ENDPOINTS } from "@utils/constants";
import { getEvmPrivateKey } from "@utils/env";
import { createBundle, submitBundle } from "@utils/gasless-api";
import { submitEvmTx } from "@utils/signatures/intent-signatures";
import { toHexPrefixString } from "@utils/string";

const AMOUNT = parseUnits("0.3", HYPERCORE.USDC.evmDecimals);

async function main() {
  const account = privateKeyToAccount(toHexPrefixString(getEvmPrivateKey()));
  const publicClient = createPublicClient({ chain: hyperEvm, transport: http() });
  const walletClient = createWalletClient({ account, chain: hyperEvm, transport: http() });

  const trade: Trade = {
    srcChainId: CHAIN_IDS.HyperEVM,
    srcChainTokenIn: HYPERCORE.USDC.address,
    srcChainTokenInAmount: AMOUNT.toString(),
    srcChainAuthorityAddress: account.address,
    dstChainId: CHAIN_IDS.HyperCore,
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

  console.log("Creating HyperEVM USDC -> HyperCore USDC transfer...");
  const bundle = await createBundle(request, HYPERLIQUID_ENDPOINTS);
  console.log(JSON.stringify(bundle, null, 2));

  const signedData: SignedDataItem[] = [];
  for (const action of bundle.intents[0].requiredActions) {
    const hash = await submitEvmTx(action.data as Tx, walletClient);
    console.log(`Broadcast ${action.actions.join(", ")}: ${hash}`);
    const receipt = await publicClient.waitForTransactionReceipt({ hash: hash as `0x${string}` });
    if (receipt.status !== "success") {
      throw new Error(`Transaction ${hash} reverted.`);
    }
    signedData.push({ actionId: action.actionId, signedData: hash });
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
