import { getUrl, postUrl } from "@utils/index";
import { PRICE_RATES_URL, PRICE_CHART_URL } from "@utils/constants";
import {
  TokenPriceRequestItem,
  TokenPriceResponse,
  ChartParams,
  ChartResponse,
} from "./types";

export async function fetchTokenRates(
  tokens: TokenPriceRequestItem[],
): Promise<TokenPriceResponse> {
  return postUrl(PRICE_RATES_URL, { tokens }) as Promise<TokenPriceResponse>;
}

export async function fetchTokenChart(
  params: ChartParams,
): Promise<ChartResponse> {
  const qs = new URLSearchParams({
    chainId: params.chainId.toString(),
    tokenAddress: params.tokenAddress,
    range: params.range,
    type: params.type,
  });

  return getUrl(`${PRICE_CHART_URL}?${qs}`) as Promise<ChartResponse>;
}
