export const WEB_SEARCH_USD_PER_QUERY = 0.007;
export const GATEWAY_USD_PER_INVOCATION = 0.000005;
export const WEB_SEARCH_PRICE_VERIFIED_AT = '2026-08-17';

function roundJpy(value: number): number {
  return Math.round((value + Number.EPSILON) * 100_000_000) / 100_000_000;
}

export function estimateWebSearchCostJpy(queryCount: number, usdToJpyRate: number): number | undefined {
  if (!Number.isSafeInteger(queryCount) || queryCount < 0 || !Number.isFinite(usdToJpyRate)) return undefined;
  return roundJpy(queryCount * (WEB_SEARCH_USD_PER_QUERY + GATEWAY_USD_PER_INVOCATION) * usdToJpyRate);
}
