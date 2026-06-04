/**
 * check-balances.ts
 *
 * Prints the wallet's non-zero balances across all supported EVM chains and
 * Solana, with approximate USD values. Read-only — fetches nothing but balances
 * and prices.
 *
 * Run with:  npx tsx src/gasless-intents/utility-scripts/check-balances.ts
 */
import "dotenv/config";
import { privateKeyToAccount } from "viem/accounts";
import { Connection, Keypair } from "@solana/web3.js";
import bs58 from "bs58";

import { SOLANA_RPC_URL } from "@utils/constants";
import { collectAndPrintHoldings } from "./wallet-holdings/holdings-report";

async function main() {
  const privateKey = process.env.SIGNER_PK;
  const solPrivateKey = process.env.SOL_PK;
  if (!privateKey) throw new Error("SIGNER_PK not found in .env");
  if (!solPrivateKey) throw new Error("SOL_PK not found in .env");

  const account = privateKeyToAccount(privateKey.startsWith("0x") ? (privateKey as `0x${string}`) : `0x${privateKey}`);
  const solKeypair = Keypair.fromSecretKey(bs58.decode(solPrivateKey));

  console.log("=== Wallet Balances ===");
  console.log(`EVM Address:    ${account.address}`);
  console.log(`Solana Address: ${solKeypair.publicKey.toBase58()}\n`);

  const solConnection = new Connection(process.env.SOL_RPC_URL || SOLANA_RPC_URL, "confirmed");

  await collectAndPrintHoldings(account.address, solConnection, solKeypair.publicKey);
}

main().catch((error) => {
  console.error("\n🚨 FATAL ERROR in script execution:", error);
  process.exitCode = 1;
});
