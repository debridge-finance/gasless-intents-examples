import { writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";
import { fetchTokenRates } from "@price/client";
import { renderRatesTableSvg } from "@price/renderers/rates-table";
import { TokenPriceRequestItem } from "@price/types";

// ── Edit these ──────────────────────────────────────────────
const TOKENS: TokenPriceRequestItem[] = [
  { chainId: 1, tokenAddress: "0xdAC17F958D2ee523a2206206994597C13D831ec7" }, // USDT
  { chainId: 1, tokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" }, // USDC
  { chainId: 1, tokenAddress: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" }, // WETH
  { chainId: 1, tokenAddress: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599" }, // WBTC
];

const OUTPUT = "output/token-rates.svg";
// ────────────────────────────────────────────────────────────

async function main() {
  console.log(`Fetching rates for ${TOKENS.length} token(s)...`);
  const response = await fetchTokenRates(TOKENS);

  console.log(JSON.stringify(response, null, 2));

  console.log("Rendering SVG...");
  const svg = await renderRatesTableSvg(response.tokens);

  const outPath = resolve(OUTPUT);
  mkdirSync(resolve(outPath, ".."), { recursive: true });
  writeFileSync(outPath, svg);
  console.log(`Written to ${outPath}`);
}

main().catch((error) => {
  console.error("\n🚨 FATAL ERROR in script execution:", error);
  process.exitCode = 1;
});
