import { writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";
import { fetchTokenChart } from "@price/client";
import { renderPriceChartSvg } from "@price/renderers/price-chart";
import { ChartRange, ChartType } from "@price/types";
import { CHAIN_IDS } from "@utils/chains";
import { WBTC } from "@utils/constants";

// ── Edit these ──────────────────────────────────────────────
const CHAIN_ID = CHAIN_IDS.Ethereum;
const TOKEN_ADDRESS = WBTC.Ethereum;
const TOKEN_LABEL = "WBTC";
const CHART_TYPE = ChartType.LINE;
const RANGE = ChartRange.ALL;
const THEME: "dark" | "light" = "dark";
// ────────────────────────────────────────────────────────────

async function main() {
  console.log(`Fetching ${CHART_TYPE} chart for ${TOKEN_LABEL} (${RANGE})...`);
  const response = await fetchTokenChart({
    chainId: CHAIN_ID,
    tokenAddress: TOKEN_ADDRESS,
    range: RANGE,
    type: CHART_TYPE,
  });

  console.log(JSON.stringify({
    token: TOKEN_LABEL,
    chainId: response.chainId,
    type: response.type,
    range: response.range,
    interval: response.interval,
    pointCount: response.points.length,
  }, null, 2));

  console.log("Rendering SVG...");
  const svg = await renderPriceChartSvg(response, TOKEN_LABEL, THEME);

  const outPath = resolve(`output/token-chart-${CHART_TYPE}-${RANGE}.svg`);
  mkdirSync(resolve(outPath, ".."), { recursive: true });
  writeFileSync(outPath, svg);
  console.log(`Written to ${outPath}`);
}

main().catch((error) => {
  console.error("\n🚨 FATAL ERROR in script execution:", error);
  process.exitCode = 1;
});
