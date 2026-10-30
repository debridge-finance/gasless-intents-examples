import { formatUnits, type Hex, type PublicClient } from "viem";
import { erc20Balance } from "@utils/contract-calls/erc20";

const MONITOR_ATTEMPTS = 96;
const MONITOR_INTERVAL_MS = 5_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Periodically polls `holder`'s balance of the intent's input `token`; the
 * fill is detected when the balance drops by at least `budget`. Returns true
 * when filled, false on timeout (the intent may still fill later, before its
 * expiration).
 *
 * This is the reliable fill signal for on-chain-submitted intents: the
 * explorer never indexes them, and `isIntentSubmitted` stays true after a
 * fill (the budget is spent; the flag is not cleared).
 */
export async function monitorFill(
  publicClient: PublicClient,
  token: Hex,
  holder: Hex,
  budget: bigint,
  decimals = 6,
): Promise<boolean> {
  const startBalance = await erc20Balance(publicClient, token, holder);

  for (let i = 0; i < MONITOR_ATTEMPTS; i++) {
    const balance = await erc20Balance(publicClient, token, holder);
    const pulled = startBalance > balance ? startBalance - balance : 0n;

    if (pulled >= budget) {
      console.log(`   [${i}] FILLED ✅ — ${formatUnits(pulled, decimals)} pulled from ${holder}`);
      return true;
    }

    console.log(`   [${i}] pending — pulled ${formatUnits(pulled, decimals)}/${formatUnits(budget, decimals)}`);
    await sleep(MONITOR_INTERVAL_MS);
  }

  console.log("   monitor timed out — no pull yet (intent may still fill before expiry).");
  return false;
}
