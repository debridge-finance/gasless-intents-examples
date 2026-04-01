import { writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";
import { fetchTokenRates } from "@price/client";
import { renderRatesTableSvg } from "@price/renderers/rates-table";
import { TokenPriceRequestItem } from "@price/types";
import { CHAIN_IDS } from "@utils/chains";
import { USDT, USDC, WETH, WBTC } from "@utils/constants";

// ── Edit these ──────────────────────────────────────────────
const TOKENS: TokenPriceRequestItem[] = [
  { chainId: CHAIN_IDS.Ethereum, tokenAddress: USDT.Ethereum },
  { chainId: CHAIN_IDS.Ethereum, tokenAddress: USDC.Ethereum },
  { chainId: CHAIN_IDS.Ethereum, tokenAddress: WETH.Ethereum },
  { chainId: CHAIN_IDS.Ethereum, tokenAddress: WBTC.Ethereum },
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
