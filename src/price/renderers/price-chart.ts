import { ChartResponse, ChartType, ChartRange, LineChartResponse, OHLCChartResponse } from "@price/types";

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

function axisFormat(range: string): { format: string; title: string } {
  switch (range) {
    case ChartRange.HOUR:
    case ChartRange.DAY:
      return { format: "%H:%M", title: "Time" };
    case ChartRange.WEEK:
      return { format: "%a %d", title: "Date" };
    case ChartRange.MONTH:
      return { format: "%b %d", title: "Date" };
    case ChartRange.THREE_MONTHS:
    case ChartRange.SIX_MONTHS:
      return { format: "%b %d", title: "Date" };
    case ChartRange.YEAR:
      return { format: "%b %Y", title: "Date" };
    case ChartRange.FIVE_YEARS:
    case ChartRange.ALL:
      return { format: "%b %Y", title: "Date" };
    default:
      return { format: "%b %d, %Y", title: "Date" };
  }
}

function buildLineSpec(data: LineChartResponse, title: string, theme: ChartTheme): any {
  const now = new Date().toISOString();
  const lastPoint = data.points[data.points.length - 1];
  const points = data.points.map((p) => ({
    time: new Date(p.t * 1000).toISOString(),
    rate: p.rate,
  }));
  // Extend to current time so the axis shows "now"
  points.push({ time: now, rate: lastPoint.rate });

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
    mark: { type: "line", color: theme.lineColor, strokeWidth: 1.5 },
    encoding: {
      x: { field: "time", type: "temporal", title: axisFormat(data.range).title, axis: { format: axisFormat(data.range).format, labelAngle: -45 } },
      y: { field: "rate", type: "quantitative", title: "Price (USD)", scale: { zero: false } },
    },
  };
}

function buildOhlcSpec(data: OHLCChartResponse, title: string, theme: ChartTheme): any {
  const now = new Date().toISOString();
  const lastPoint = data.points[data.points.length - 1];
  const points = data.points.map((p) => ({
    time: new Date(p.t * 1000).toISOString(),
    open: p.o,
    high: p.h,
    low: p.l,
    close: p.c,
    volume: p.v,
    direction: p.c >= p.o ? "up" : "down",
  }));
  // Extend to current time so the axis shows "now"
  points.push({ time: now, open: lastPoint.c, high: lastPoint.c, low: lastPoint.c, close: lastPoint.c, volume: 0, direction: "up" });

  const { format, title: xTitle } = axisFormat(data.range);

  // Scale bar width to data density — leave ~30% gap between bars
  const chartWidth = 720;
  const barWidth = Math.max(1, Math.floor((chartWidth / points.length) * 0.7));
  const wickWidth = Math.max(0.5, barWidth <= 3 ? 0.5 : 1);

  return {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    padding: 24,
    title: { text: title, color: theme.textColor, fontSize: 16 },
    config: {
      background: theme.background,
      axis: { gridColor: theme.axisColor, domainColor: theme.axisColor, tickColor: theme.axisColor, labelColor: theme.textColor, titleColor: theme.textColor },
      concat: { spacing: 2 },
    },
    data: { values: points },
    vconcat: [
      // Price panel (candlesticks)
      {
        width: chartWidth,
        height: 300,
        encoding: {
          x: { field: "time", type: "temporal", axis: { format, labels: false, title: null, grid: true, gridOpacity: 0.3 } },
          color: {
            field: "direction",
            type: "nominal",
            scale: { domain: ["up", "down"], range: [theme.upColor, theme.downColor] },
            legend: null,
          },
        },
        layer: [
          {
            mark: { type: "rule", strokeWidth: wickWidth },
            encoding: {
              y: { field: "low", type: "quantitative", title: "Price (USD)", scale: { zero: false } },
              y2: { field: "high" },
            },
          },
          {
            mark: { type: "bar", width: barWidth },
            encoding: {
              y: { field: "open", type: "quantitative" },
              y2: { field: "close" },
            },
          },
        ],
      },
      // Volume panel
      {
        width: chartWidth,
        height: 60,
        mark: { type: "bar", width: barWidth },
        encoding: {
          x: { field: "time", type: "temporal", title: xTitle, axis: { format, labelAngle: -45, gridOpacity: 0.3 } },
          y: { field: "volume", type: "quantitative", title: "Volume", axis: { tickCount: 3 } },
          color: {
            field: "direction",
            type: "nominal",
            scale: { domain: ["up", "down"], range: [theme.upColor, theme.downColor] },
            legend: null,
          },
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
