import { formatUnits, type Address } from "viem";
import { Connection, PublicKey } from "@solana/web3.js";
import { collectEvmHoldings, collectSolanaHoldings } from "./collect-balances";
import { valueHoldings } from "./pricing";
import { Holding } from "./holding";

export type HoldingsReport = {
  holdings: Holding[];
  usdValueByHolding: Map<Holding, number | null>;
};

export function formatUsdValue(usdValue: number | null): string {
  return usdValue === null ? "(price n/a)" : `≈$${usdValue.toFixed(2)}`;
}

/** Prints a single holding row: `<chain> <symbol> <amount>  <trailing>`. */
export function printHoldingRow(holding: Holding, trailing: string): void {
  const amount = formatUnits(holding.rawBalance, holding.decimals);
  console.log(`  ${holding.chainName.padEnd(9)} ${holding.symbol.padEnd(10)} ${amount.padStart(22)}  ${trailing}`);
}

/**
 * Collects every non-zero holding across the EVM chains and Solana, values them
 * in USD, prints a balances table, and returns the data for further use.
 *
 * Self-contained so any script can call it just to dump a wallet's balances.
 */
export async function collectAndPrintHoldings(
  evmAddress: Address,
  solConnection: Connection,
  solOwner: PublicKey,
): Promise<HoldingsReport> {
  console.log("Fetching balances...");
  const [evmHoldings, solHoldings] = await Promise.all([
    collectEvmHoldings(evmAddress),
    collectSolanaHoldings(solConnection, solOwner),
  ]);
  const holdings = [...evmHoldings, ...solHoldings];

  console.log("Fetching USD prices...");
  const usdValueByHolding = await valueHoldings(holdings);

  console.log("\n--- Balances ---");
  if (holdings.length === 0) console.log("  (none)");
  for (const holding of holdings) {
    printHoldingRow(holding, formatUsdValue(usdValueByHolding.get(holding) ?? null));
  }

  return { holdings, usdValueByHolding };
}
