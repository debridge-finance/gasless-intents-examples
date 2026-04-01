import { ChartResponse, ChartType, LineChartResponse, OHLCChartResponse } from "../types";

// vega 6+ is ESM-only; use dynamic import() for CJS compatibility
async function loadVega() {
  const vega = await import("vega");
  // @ts-expect-error vega-lite exports require moduleResolution node16+
  const vl = await import("vega-lite");
  return { vega, vl };
}

export interface ChartTheme {
  background: string;
  lineColor: string;
  axisColor: string;
  textColor: string;
  upColor: string;
  downColor: string;
}

export const DARK_THEME: ChartTheme = {
  background: "#1a1a2e",
  lineColor: "#00e676",
  axisColor: "#555",
  textColor: "#e0e0e0",
  upColor: "#00e676",
  downColor: "#ff5252",
};

export const LIGHT_THEME: ChartTheme = {
  background: "#ffffff",
  lineColor: "#1976d2",
  axisColor: "#ccc",
  textColor: "#333333",
  upColor: "#4caf50",
  downColor: "#f44336",
};

function buildLineSpec(data: LineChartResponse, title: string, theme: ChartTheme): any {
  const points = data.points.map((p) => ({
    time: new Date(p.t * 1000).toISOString(),
    rate: p.rate,
  }));

  return {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    width: 720,
    height: 360,
    padding: 24,
    title: { text: title, color: theme.textColor, fontSize: 16 },
    config: {
      background: theme.background,
      axis: { gridColor: theme.axisColor, domainColor: theme.axisColor, tickColor: theme.axisColor, labelColor: theme.textColor, titleColor: theme.textColor },
    },
    data: { values: points },
    mark: { type: "line", color: theme.lineColor, strokeWidth: 2 },
    encoding: {
      x: { field: "time", type: "temporal", title: "Time", axis: { format: "%H:%M", labelAngle: -45 } },
      y: { field: "rate", type: "quantitative", title: "Price (USD)", scale: { zero: false } },
    },
  };
}

function buildOhlcSpec(data: OHLCChartResponse, title: string, theme: ChartTheme): any {
  const points = data.points.map((p) => ({
    time: new Date(p.t * 1000).toISOString(),
    open: p.o,
    high: p.h,
    low: p.l,
    close: p.c,
    volume: p.v,
    direction: p.c >= p.o ? "up" : "down",
  }));

  return {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    width: 720,
    height: 360,
    padding: 24,
    title: { text: title, color: theme.textColor, fontSize: 16 },
    config: {
      background: theme.background,
      axis: { gridColor: theme.axisColor, domainColor: theme.axisColor, tickColor: theme.axisColor, labelColor: theme.textColor, titleColor: theme.textColor },
    },
    data: { values: points },
    encoding: {
      x: { field: "time", type: "temporal", title: "Time", axis: { format: "%H:%M", labelAngle: -45 } },
      color: {
        field: "direction",
        type: "nominal",
        scale: { domain: ["up", "down"], range: [theme.upColor, theme.downColor] },
        legend: null,
      },
    },
    layer: [
      // High-low wicks
      {
        mark: { type: "rule" },
        encoding: {
          y: { field: "low", type: "quantitative", title: "Price (USD)", scale: { zero: false } },
          y2: { field: "high" },
        },
      },
      // Open-close bodies
      {
        mark: { type: "bar", width: 8 },
        encoding: {
          y: { field: "open", type: "quantitative" },
          y2: { field: "close" },
        },
      },
    ],
  };
}

export async function renderPriceChartSvg(
  data: ChartResponse,
  tokenLabel: string,
  theme: "dark" | "light" = "dark",
): Promise<string> {
  const { vega, vl } = await loadVega();

  const chartTheme = theme === "light" ? LIGHT_THEME : DARK_THEME;
  const title = `${tokenLabel} Price`;

  const vlSpec =
    data.type === ChartType.OHLC
      ? buildOhlcSpec(data as OHLCChartResponse, title, chartTheme)
      : buildLineSpec(data as LineChartResponse, title, chartTheme);

  const vegaSpec = vl.compile(vlSpec).spec;
  const view = new vega.View(vega.parse(vegaSpec), { renderer: "none" });
  return view.toSVG();
}
