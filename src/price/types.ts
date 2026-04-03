// --- Enums ---

export enum ChartRange {
  HOUR = "HOUR",
  DAY = "DAY",
  WEEK = "WEEK",
  MONTH = "MONTH",
  THREE_MONTHS = "THREE_MONTHS",
  SIX_MONTHS = "SIX_MONTHS",
  YEAR = "YEAR",
  FIVE_YEARS = "FIVE_YEARS",
  ALL = "ALL",
}

export enum ChartType {
  LINE = "line",
  OHLC = "ohlc",
}

// --- Token Price (POST /v1/token/price) ---

export interface TokenPriceRequestItem {
  chainId: number;
  tokenAddress: string;
}

export interface TokenPriceResponseItem {
  address: string;
  chainId: number;
  symbol: string;
  name: string;
  decimals: number;
  logoUrl: string;
  rate: number;
  eodRate: number;
  changePercent: number;
  rateUpdatedAt: string;
  eodRateUpdatedAt: string;
}

export interface TokenPriceResponse {
  tokens: TokenPriceResponseItem[];
}

// --- Token Chart (GET /v1/token/chart) ---

export interface ChartParams {
  chainId: number;
  tokenAddress: string;
  range: ChartRange;
  type: ChartType;
}

export interface LinePoint {
  t: number;
  rate: number;
}

export interface OHLCPoint {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export interface LineChartResponse {
  tokenAddress: string;
  chainId: number;
  type: ChartType.LINE;
  range: string;
  interval: string;
  points: LinePoint[];
}

export interface OHLCChartResponse {
  tokenAddress: string;
  chainId: number;
  type: ChartType.OHLC;
  range: string;
  interval: string;
  points: OHLCPoint[];
}

export type ChartResponse = LineChartResponse | OHLCChartResponse;
