import type { ModelKey } from './model-catalog.js';

export const DEFAULT_USD_TO_JPY_RATE = 150;
export const MIN_USD_TO_JPY_RATE = 1;
export const MAX_USD_TO_JPY_RATE = 1_000;

interface ModelPricePeriod {
  effectiveFrom: string;
  effectiveUntil?: string;
  inputUsdPerMillionTokens: number;
  outputUsdPerMillionTokens: number;
  priceVerifiedAt: string;
}

export interface ModelCostEstimate {
  modelKey: ModelKey;
  currency: 'JPY';
  inputCostJpy: number;
  outputCostJpy: number;
  totalCostJpy: number;
  inputUsdPerMillionTokens: number;
  outputUsdPerMillionTokens: number;
  usdToJpyRate: number;
  priceVerifiedAt: string;
  scope: 'MODEL_INFERENCE_ONLY';
}

export interface ModelUsage {
  inputTokens?: number;
  outputTokens?: number;
  estimate?: ModelCostEstimate;
}

// Standard on-demand model rates verified against the AWS Bedrock pricing page and
// Price List API for the Tokyo source region on 2026-08-17.
const MODEL_PRICE_SCHEDULES: Record<ModelKey, readonly ModelPricePeriod[]> = {
  'claude-sonnet-5': [
    {
      effectiveFrom: '1970-01-01T00:00:00.000Z',
      effectiveUntil: '2026-09-01T00:00:00.000Z',
      inputUsdPerMillionTokens: 2,
      outputUsdPerMillionTokens: 10,
      priceVerifiedAt: '2026-08-17',
    },
    {
      effectiveFrom: '2026-09-01T00:00:00.000Z',
      inputUsdPerMillionTokens: 3,
      outputUsdPerMillionTokens: 15,
      priceVerifiedAt: '2026-08-17',
    },
  ],
  'nova-micro': [{
    effectiveFrom: '1970-01-01T00:00:00.000Z',
    inputUsdPerMillionTokens: 0.042,
    outputUsdPerMillionTokens: 0.168,
    priceVerifiedAt: '2026-08-17',
  }],
  'nova-2-lite': [{
    effectiveFrom: '1970-01-01T00:00:00.000Z',
    inputUsdPerMillionTokens: 0.396,
    outputUsdPerMillionTokens: 3.311,
    priceVerifiedAt: '2026-08-17',
  }],
  'nova-pro': [{
    effectiveFrom: '1970-01-01T00:00:00.000Z',
    inputUsdPerMillionTokens: 0.96,
    outputUsdPerMillionTokens: 3.84,
    priceVerifiedAt: '2026-08-17',
  }],
};

function priceFor(modelKey: ModelKey, at: Date): ModelPricePeriod {
  const timestamp = at.getTime();
  const schedule = MODEL_PRICE_SCHEDULES[modelKey];
  return schedule.find((period) => {
    const starts = Date.parse(period.effectiveFrom);
    const ends = period.effectiveUntil ? Date.parse(period.effectiveUntil) : Number.POSITIVE_INFINITY;
    return timestamp >= starts && timestamp < ends;
  }) ?? schedule[schedule.length - 1];
}

function roundJpy(value: number): number {
  return Math.round((value + Number.EPSILON) * 100_000_000) / 100_000_000;
}

export function estimateModelInvocationCost(
  modelKey: ModelKey,
  inputTokens: number | undefined,
  outputTokens: number | undefined,
  usdToJpyRate: number,
  at = new Date(),
): ModelCostEstimate | undefined {
  if (
    !Number.isSafeInteger(inputTokens)
    || !Number.isSafeInteger(outputTokens)
    || (inputTokens ?? -1) < 0
    || (outputTokens ?? -1) < 0
    || !Number.isFinite(usdToJpyRate)
    || usdToJpyRate < MIN_USD_TO_JPY_RATE
    || usdToJpyRate > MAX_USD_TO_JPY_RATE
  ) return undefined;

  const price = priceFor(modelKey, at);
  const inputCostJpy = roundJpy(
    (inputTokens as number) * price.inputUsdPerMillionTokens * usdToJpyRate / 1_000_000,
  );
  const outputCostJpy = roundJpy(
    (outputTokens as number) * price.outputUsdPerMillionTokens * usdToJpyRate / 1_000_000,
  );

  return {
    modelKey,
    currency: 'JPY',
    inputCostJpy,
    outputCostJpy,
    totalCostJpy: roundJpy(inputCostJpy + outputCostJpy),
    inputUsdPerMillionTokens: price.inputUsdPerMillionTokens,
    outputUsdPerMillionTokens: price.outputUsdPerMillionTokens,
    usdToJpyRate,
    priceVerifiedAt: price.priceVerifiedAt,
    scope: 'MODEL_INFERENCE_ONLY',
  };
}
