import { ExtendedHook, Trade } from "@gasless-intents/types";
import { Holding } from "../wallet-holdings/holding";
import { printHoldingRow } from "../wallet-holdings/holdings-report";
import { minimumUsdValue, solReserveLamports } from "./config";
import { buildTrade, buildTransferHook, isSameEvmChainSameToken } from "./build-bundle-items";

export type SkippedHolding = { holding: Holding; reason: string };

export type BundleItems = { trades: Trade[]; preHooks: ExtendedHook[] };

export type ClassifiedHoldings = { includedHoldings: Holding[]; skippedHoldings: SkippedHolding[] };

/**
 * Splits holdings into those worth migrating and those to skip. A holding needs
 * a known price worth at least minimumUsdValue; no price means it isn't tradable
 * (e.g. junk SPL airdrops returned by getParsedTokenAccountsByOwner).
 */
export function classifyHoldings(
  holdings: Holding[],
  usdValueByHolding: Map<Holding, number | null>,
): ClassifiedHoldings {
  const includedHoldings: Holding[] = [];
  const skippedHoldings: SkippedHolding[] = [];

  for (const holding of holdings) {
    const usdValue = usdValueByHolding.get(holding) ?? null;
    if (usdValue === null) skippedHoldings.push({ holding, reason: "no USD price — not tradable" });
    else if (usdValue < minimumUsdValue) skippedHoldings.push({ holding, reason: `below $${minimumUsdValue}` });
    else includedHoldings.push(holding);
  }

  return { includedHoldings, skippedHoldings };
}

/** Amount we can actually move: full balance, less a small SOL gas reserve. */
function sweepableAmount(holding: Holding): bigint {
  if (holding.chainName === "Solana" && holding.isNative) {
    const remaining = holding.rawBalance - solReserveLamports;
    return remaining > 0n ? remaining : 0n;
  }
  return holding.rawBalance;
}

/**
 * Turns the included holdings into bundle items: same-chain/same-token holdings
 * become transfer prehooks, everything else becomes a swap/bridge trade.
 */
export function buildBundleItems(includedHoldings: Holding[], evmAddress: string, solanaAddress: string): BundleItems {
  const trades: Trade[] = [];
  const preHooks: ExtendedHook[] = [];

  for (const holding of includedHoldings) {
    const amountRaw = sweepableAmount(holding);
    if (amountRaw <= 0n) continue; // nothing left to move after the gas reserve
    if (isSameEvmChainSameToken(holding)) preHooks.push(buildTransferHook(holding, amountRaw, evmAddress));
    else trades.push(buildTrade(holding, amountRaw, evmAddress, solanaAddress));
  }

  return { trades, preHooks };
}

/** Prints the per-holding plan rows, tagged by how they'll move, plus skips. */
export function printMigrationPlan(includedHoldings: Holding[], skippedHoldings: SkippedHolding[]): void {
  for (const holding of includedHoldings) {
    printHoldingRow(holding, isSameEvmChainSameToken(holding) ? "[transfer]" : "[trade]");
  }

  if (skippedHoldings.length > 0) {
    console.log("\n--- Skipped ---");
    for (const { holding, reason } of skippedHoldings) printHoldingRow(holding, `(${reason})`);
  }
}
