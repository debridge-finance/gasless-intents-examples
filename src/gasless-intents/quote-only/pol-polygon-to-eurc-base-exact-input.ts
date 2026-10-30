// Run: npx tsx src/gasless-intents/quote-only/pol-polygon-to-eurc-base-exact-input.ts
// Quote the EURC received for 25 native POL (18 decimals).
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
      srcChainTokenInAmount: "25000000000000000000", // 25 native POL (18 decimals)
      dstChainId: CHAIN_IDS.Base,
      dstChainTokenOut: EURC_BASE,
      dstChainTokenOutAmount: "auto", // Let propose calculate the EURC output.
      prependOperatingExpenses: false,
    }],
  };

  const quote = await createBundle(requestBody);
  console.log(JSON.stringify(quote, null, 2));
  // After wallet connection, propose again with real addresses before signing or submitting.
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
