/**
 * migrate-wallet.ts
 *
 * Sweeps an entire wallet (all supported EVM chains + Solana) and consolidates
 * every meaningful holding into USDC on Polygon at a single destination address,
 * using a single deBridge gasless-intent bundle.
 *
 * Why a bundle and not plain `transfer()` calls:
 *   The wallet being migrated may hold no native gas on most chains. The whole
 *   point of the gasless-intent rail is that fees are paid out of the moved asset
 *   itself. So *every* holding is expressed as an intent in the bundle rather
 *   than a direct on-chain transfer (which would require gas we may not have).
 *   The one exception is the destination token already on the destination chain —
 *   that doesn't need a swap, so it moves via a gasless ERC-20 transfer prehook.
 *
 * Behaviour (decided with the wallet owner):
 *   - Minimum holding value: $1. Anything worth less (incl. native gas dust) is skipped.
 *   - Holdings with no known price are skipped (not tradable, e.g. junk airdrops).
 *
 * Run with:  npx tsx src/gasless-intents/utility-scripts/migrate-wallet.ts
 * 
 * Example result: 
 * https://anchorage.debridge.com/bundle/0x5a1aa47e566b7690d67b013335e5d74a9b0893db936eba8972094ed7c65fcb3c
 */
import "dotenv/config";
import { privateKeyToAccount } from "viem/accounts";
import { Connection, Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { randomUUID } from "crypto";

import { SOLANA_RPC_URL } from "@utils/constants";
import { getChainIdToWalletClientMap } from "@utils/wallet";
import { createBundle, submitBundle } from "@utils/gasless-api";
import { processIntentBundle } from "@utils/signatures/intent-signatures";
import { Bundle, BundleProposeBody, TradingAlgorithm } from "@gasless-intents/types";

import { destinationLabel, evmDestinationAddress, referralCode } from "./migrate-wallet/config";
import { collectAndPrintHoldings } from "./wallet-holdings/holdings-report";
import { buildBundleItems, classifyHoldings, printMigrationPlan } from "./migrate-wallet/utils";

async function main() {
  const privateKey = process.env.SIGNER_PK;
  const solPrivateKey = process.env.SOL_PK;
  if (!privateKey) throw new Error("SIGNER_PK not found in .env");
  if (!solPrivateKey) throw new Error("SOL_PK not found in .env");

  const account = privateKeyToAccount(privateKey.startsWith("0x") ? (privateKey as `0x${string}`) : `0x${privateKey}`);
  const solKeypair = Keypair.fromSecretKey(bs58.decode(solPrivateKey));
  const evmAddress = account.address;

  console.log("=== Wallet Migration ===");
  console.log(`Source EVM:    ${evmAddress}`);
  console.log(`Source Solana: ${solKeypair.publicKey.toBase58()}`);
  console.log(`→ Destination: ${evmDestinationAddress} (${destinationLabel})\n`);

  const solConnection = new Connection(process.env.SOL_RPC_URL || SOLANA_RPC_URL, "confirmed");

  // 1. Collect, value and print every non-zero holding.
  const { holdings, usdValueByHolding } = await collectAndPrintHoldings(evmAddress, solConnection, solKeypair.publicKey);
  
  if (holdings.length === 0) {
    console.log("\nNo non-zero balances found. Nothing to migrate.");
    return;
  }

  // 2. Keep holdings worth migrating; skip dust and untradable tokens.
  const { includedHoldings, skippedHoldings } = classifyHoldings(holdings, usdValueByHolding);

  console.log(`\n--- Plan (→ ${destinationLabel}) ---`);
  printMigrationPlan(includedHoldings, skippedHoldings);
  
  if (includedHoldings.length === 0) {
    console.log("\nNothing meets the inclusion criteria. Exiting.");
    return;
  }

  // 3. Same-chain/same-token holdings move via a transfer prehook; everything
  //    else is a swap/bridge trade into the destination token.
  const { trades, preHooks } = buildBundleItems(includedHoldings, evmAddress, solKeypair.publicKey.toBase58());

  // 4. Build, sign and (optionally) submit the bundle.
  const requestBody: BundleProposeBody = {
    requestId: randomUUID(),
    referralCode,
    expirationTimestamp: Math.floor((new Date().getTime() * 2) / 1000),
    enableAccountAbstraction: true,
    isAtomic: true,
    tradingAlgorithm: TradingAlgorithm.MARKET,
    trades,
    preHooks,
    postHooks: [],
  };

  console.log(`\nCreating bundle with ${trades.length} trade(s) and ${preHooks.length} transfer hook(s)...`);
  const bundle = await createBundle(requestBody);
  console.log("Bundle created.");

  // Sign with both the EVM account and the Solana keypair (Solana intents need the keypair).
  const chainIdToWalletClientMap = getChainIdToWalletClientMap(account, solKeypair);

  console.log("Collecting signatures for all intents...");
  const signedDataArray = await processIntentBundle(bundle, chainIdToWalletClientMap);
  console.log(`Generated ${signedDataArray.length} signatures for ${bundle.intents?.length || 0} intents`);

  const submitPayload: Bundle = {
    ...bundle,
    requestId: requestBody.requestId,
    enableAccountAbstraction: true,
    isAtomic: requestBody.isAtomic,
    signedData: signedDataArray,
  };

  console.log("Submitting bundle...");
  const submitResponse = await submitBundle(submitPayload);
  console.log("Submit response:", submitResponse);

  return submitPayload;
}

main().catch((error) => {
  console.error("\n🚨 FATAL ERROR in script execution:", error);
  process.exitCode = 1;
});
