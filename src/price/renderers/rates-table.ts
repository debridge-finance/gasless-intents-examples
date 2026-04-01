import { TokenPriceResponseItem } from "../types";

// vega 6+ is ESM-only; use dynamic import() for CJS compatibility
async function loadVega() {
  const vega = await import("vega");
  // @ts-expect-error vega-lite exports require moduleResolution node16+
  const vl = await import("vega-lite");
  return { vega, vl };
}

export async function renderRatesTableSvg(
  tokens: TokenPriceResponseItem[],
): Promise<string> {
  const { vega, vl } = await loadVega();

  const rows = tokens.map((t, i) => ({
    row: i,
    symbol: t.symbol.toUpperCase(),
    name: t.name,
    rate: `$${t.rate.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    change: t.changePercent != null ? `${t.changePercent >= 0 ? "+" : ""}${t.changePercent.toFixed(2)}%` : "—",
    changeSign: t.changePercent != null ? (t.changePercent >= 0 ? "positive" : "negative") : "neutral",
  }));

  const columns = ["symbol", "name", "rate", "change"];
  const headers = ["Symbol", "Name", "Price (USD)", "24h Change"];
  const colWidth = 160;
  const rowHeight = 32;

  const headerData = headers.map((h, i) => ({
    row: -1,
    col: i,
    text: h,
    x: i * colWidth + colWidth / 2,
    y: rowHeight / 2,
  }));

  const cellData = rows.flatMap((r) =>
    columns.map((col, ci) => ({
      row: r.row,
      col: ci,
      text: (r as Record<string, unknown>)[col] as string,
      x: ci * colWidth + colWidth / 2,
      y: (r.row + 1) * rowHeight + rowHeight / 2,
      changeSign: col === "change" ? r.changeSign : "neutral",
    })),
  );

  const totalWidth = colWidth * columns.length;
  const totalHeight = (rows.length + 1) * rowHeight;

  const vlSpec: any = {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    width: totalWidth,
    height: totalHeight,
    padding: 16,
    config: {
      background: "#1a1a2e",
      style: { "guide-label": { fill: "#e0e0e0" }, "guide-title": { fill: "#e0e0e0" } },
    },
    layer: [
      // Alternating row backgrounds
      {
        data: { values: rows.map((r) => ({ row: r.row, y: (r.row + 1) * rowHeight, width: totalWidth, height: rowHeight })) },
        mark: { type: "rect" },
        encoding: {
          x: { value: 0 },
          y: { field: "y", type: "quantitative", scale: null },
          x2: { value: totalWidth },
          y2: { datum: { expr: "datum.y + datum.height" } },
          color: {
            condition: { test: "datum.row % 2 === 0", value: "#16213e" },
            value: "#1a1a2e",
          },
        },
      },
      // Header background
      {
        data: { values: [{ x: 0, y: 0 }] },
        mark: { type: "rect", color: "#0f3460" },
        encoding: {
          x: { value: 0 },
          y: { value: 0 },
          x2: { value: totalWidth },
          y2: { value: rowHeight },
        },
      },
      // Header text
      {
        data: { values: headerData },
        mark: { type: "text", fontWeight: "bold", fontSize: 13, fill: "#e0e0e0" },
        encoding: {
          x: { field: "x", type: "quantitative", scale: null },
          y: { field: "y", type: "quantitative", scale: null },
          text: { field: "text", type: "nominal" },
        },
      },
      // Cell text
      {
        data: { values: cellData },
        mark: { type: "text", fontSize: 12 },
        encoding: {
          x: { field: "x", type: "quantitative", scale: null },
          y: { field: "y", type: "quantitative", scale: null },
          text: { field: "text", type: "nominal" },
          color: {
            field: "changeSign",
            type: "nominal",
            scale: {
              domain: ["positive", "negative", "neutral"],
              range: ["#00e676", "#ff5252", "#b0b0b0"],
            },
            legend: null,
          },
        },
      },
    ],
  };

  const vegaSpec = vl.compile(vlSpec).spec;
  const view = new vega.View(vega.parse(vegaSpec), { renderer: "none" });
  return view.toSVG();
}
