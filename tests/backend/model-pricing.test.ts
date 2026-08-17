import { describe, expect, it } from 'vitest';
import { estimateModelInvocationCost } from '../../shared/model-pricing.js';

describe('model invocation cost estimates', () => {
  it.each([
    ['nova-micro', 0.0063, 0.0126, 0.0189],
    ['nova-2-lite', 0.0594, 0.248325, 0.307725],
    ['nova-pro', 0.144, 0.288, 0.432],
  ] as const)('uses the Tokyo source-region rate for %s', (modelKey, input, output, total) => {
    const estimate = estimateModelInvocationCost(
      modelKey,
      1_000,
      500,
      150,
      new Date('2026-08-17T00:00:00.000Z'),
    );
    expect(estimate).toMatchObject({ inputCostJpy: input, outputCostJpy: output, totalCostJpy: total });
  });

  it('switches Claude Sonnet 5 from launch pricing after August 2026', () => {
    const promotional = estimateModelInvocationCost(
      'claude-sonnet-5',
      1_000,
      500,
      150,
      new Date('2026-08-31T23:59:59.000Z'),
    );
    const standard = estimateModelInvocationCost(
      'claude-sonnet-5',
      1_000,
      500,
      150,
      new Date('2026-09-01T00:00:00.000Z'),
    );

    expect(promotional).toMatchObject({
      inputUsdPerMillionTokens: 2,
      outputUsdPerMillionTokens: 10,
      totalCostJpy: 1.05,
    });
    expect(standard).toMatchObject({
      inputUsdPerMillionTokens: 3,
      outputUsdPerMillionTokens: 15,
      totalCostJpy: 1.575,
    });
  });

  it('does not estimate when usage or the conversion rate is invalid', () => {
    expect(estimateModelInvocationCost('nova-micro', undefined, 10, 150)).toBeUndefined();
    expect(estimateModelInvocationCost('nova-micro', -1, 10, 150)).toBeUndefined();
    expect(estimateModelInvocationCost('nova-micro', 10, 10, 0)).toBeUndefined();
  });
});
