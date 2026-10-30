/**
 * Aave withdrawal: USDC on Arbitrum → exactly 1 USDC on Base.
 *
 * totalDstAmount is the net destination amount after operating expenses.
 * The single trade supplies the amount needed to reach that target.
 * Requires a sufficient USDC deposit in Aave V3 on Arbitrum; the pre-hook
 * withdraws the calculated input amount before the trade executes.
 *
 * Usage: npx tsx ./src/gasless-intents/trades/total-dst-amount/exact-dst-amount-balancing-trade.ts
 */

import { privateKeyToAccount } from "viem/accounts";
import { randomUUID } from "crypto";

import { clipHexPrefix, toHexPrefixString } from "@utils/string";
import { getEnvConfig } from "@utils/env";
import { createBundle, submitBundle } from "@utils/gasless-api";
import { processIntentBundle } from "@utils/signatures/intent-signatures";
import { getChainIdToWalletClientMap } from "@utils/wallet";
import { CHAIN_IDS } from "@utils/chains";
import { USDC, AAVE_V3_POOL_ARBITRUM } from "@utils/constants";
import { Bundle, BundleProposeBody, Trade, TradingAlgorithm, TokenAmount } from "@gasless-intents/types";
import { getAaveWithdrawHook } from "@utils/hooks/aave";

async function main() {
  const { privateKey } = getEnvConfig();
  const account = privateKeyToAccount(`0x${clipHexPrefix(privateKey)}`);
  const chainIdToWalletClientMap = getChainIdToWalletClientMap(account);

  // 1 USDC on Base (6 decimals).
  const totalDstAmount = (1n * 10n ** 6n).toString();

  // The pre-hook supplies the input calculated for this auto/auto trade.
  const trade: Trade = {
    srcChainId: CHAIN_IDS.Arbitrum,
    srcChainTokenIn: USDC.Arbitrum,
    srcChainTokenInAmount: TokenAmount.AUTO,

    dstChainId: CHAIN_IDS.Base,
    dstChainTokenOut: USDC.Base,
    dstChainTokenOutAmount: TokenAmount.AUTO,
    dstChainTokenOutRecipient: account.address,

    srcChainAuthorityAddress: account.address,
    dstChainAuthorityAddress: account.address,

    prependOperatingExpenses: false,
  };

  const aaveWithdrawHook = await getAaveWithdrawHook(
    toHexPrefixString(AAVE_V3_POOL_ARBITRUM),
    toHexPrefixString(USDC.Arbitrum),
    CHAIN_IDS.Arbitrum,
    account.address,
  );

  console.log("AAVE withdraw pre-hook:", JSON.stringify(aaveWithdrawHook, null, 2));

  const requestBody: BundleProposeBody = {
    requestId: randomUUID(),
    expirationTimestamp: Math.floor((new Date().getTime() * 2) / 1000),
    enableAccountAbstraction: true,
    isAtomic: true,
    tradingAlgorithm: TradingAlgorithm.MARKET,
    trades: [trade],
    preHooks: [aaveWithdrawHook],
    totalDstAmount,
  };

  console.log("Creating bundle (Aave USDC on Arbitrum → 1 USDC on Base)...");
  console.log(`  totalDstAmount: ${totalDstAmount}`);

  const bundle = await createBundle(requestBody);
  console.log("\nBundle created!");
  console.log(JSON.stringify(bundle, null, 2));

  console.log("\nCollecting signatures...");
  const signedDataArray = await processIntentBundle(bundle, chainIdToWalletClientMap);
  console.log(`Generated ${signedDataArray.length} signatures`);

  const submitPayload: Bundle = {
    ...bundle,
    requestId: requestBody.requestId,
    enableAccountAbstraction: true,
    isAtomic: true,
    signedData: signedDataArray,
  };

  console.log("\nSubmitting...");
  const submitResponse = await submitBundle(submitPayload);
  console.log("Submit response:", submitResponse);
}

main().catch((error) => {
  console.error("\nFATAL ERROR in script execution:", error);
  process.exitCode = 1;
});
