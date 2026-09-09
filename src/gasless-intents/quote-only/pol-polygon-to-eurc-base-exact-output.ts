// Run: npx tsx src/gasless-intents/quote-only/pol-polygon-to-eurc-base-exact-output.ts
// Quote the source amount required to receive 2 EURC.
// Wallet addresses are omitted to use propose in quote-only mode.
import { randomUUID } from "crypto";
import { BundleQuoteBody, TradingAlgorithm } from "@gasless-intents/types";
import { CHAIN_IDS } from "@utils/chains";
import { EURC_BASE, EVM_NATIVE_TOKEN } from "@utils/constants";
import { getReferralCode } from "@utils/env";
import { createBundle } from "@utils/gasless-api";

async function main() {
  const requestBody: BundleQuoteBody = {
    requestId: randomUUID(),
    referralCode: getReferralCode(),
    expirationTimestamp: Math.floor(Date.now() / 1000) + 20 * 60,
    enableAccountAbstraction: true,
    isAtomic: true,
    tradingAlgorithm: TradingAlgorithm.MARKET,
    trades: [{
      srcChainId: CHAIN_IDS.Polygon,
      srcChainTokenIn: EVM_NATIVE_TOKEN,
      srcChainTokenInAmount: "auto", // Let propose calculate the required input.
      dstChainId: CHAIN_IDS.Base,
      dstChainTokenOut: EURC_BASE,
      dstChainTokenOutAmount: "2000000", // 2 EURC (6 decimals)
      prependOperatingExpenses: true,
    }],
  };

  const quote = await createBundle(requestBody);
  console.log(JSON.stringify(quote, null, 2));
  // After wallet connection, propose again with real addresses before signing and submitting.
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
