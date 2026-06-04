import { formatUnits } from "viem";
import { fetchTokenRates } from "@price/client";
import { Holding } from "./holding";

const priceKey = (chainId: number, address: string) => `${chainId}:${address.toLowerCase()}`;

/**
 * Looks up a USD value for each holding. The value is `null` when no price is
 * available — callers may treat that as "not tradable" (e.g. junk SPL airdrops).
 * Failures are isolated per holding so one bad token doesn't break the rest.
 */
export async function valueHoldings(holdings: Holding[]): Promise<Map<Holding, number | null>> {
  const usdValueByHolding = new Map<Holding, number | null>();

  const priceResults = await Promise.allSettled(
    holdings.map((holding) => fetchTokenRates([{ chainId: holding.chainId, tokenAddress: holding.tokenAddress }])),
  );

  priceResults.forEach((priceResult, index) => {
    const holding = holdings[index];
    let usdRate: number | null = null;

    if (priceResult.status === "fulfilled") {
      const matchingToken =
        priceResult.value.tokens.find(
          (token) => priceKey(token.chainId, token.address) === priceKey(holding.chainId, holding.tokenAddress),
        ) ?? priceResult.value.tokens[0];
      if (matchingToken && typeof matchingToken.rate === "number") usdRate = matchingToken.rate;
    }

    const uiAmount = Number(formatUnits(holding.rawBalance, holding.decimals));
    usdValueByHolding.set(holding, usdRate === null ? null : uiAmount * usdRate);
  });

  return usdValueByHolding;
}
