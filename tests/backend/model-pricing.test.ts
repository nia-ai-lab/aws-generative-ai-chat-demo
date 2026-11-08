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

  it('uses the global cross-region rate for Claude Sonnet 5.5', () => {
    const estimate = estimateModelInvocationCost(
      'claude-sonnet-5-5',
      1_000,
      500,
      150,
      new Date('2026-11-08T00:00:00.000Z'),
    );

    expect(estimate).toMatchObject({
      inputUsdPerMillionTokens: 2,
      outputUsdPerMillionTokens: 10,
      totalCostJpy: 1.05,
    });
  });

  it('uses the global cross-region rate for Claude Haiku 5.5', () => {
    const estimate = estimateModelInvocationCost('claude-haiku-5-5', 1_000, 500, 150);
    expect(estimate).toMatchObject({
      inputUsdPerMillionTokens: 0.1,
      outputUsdPerMillionTokens: 0.5,
      totalCostJpy: 0.0525,
    });
  });

  it('does not estimate when usage or the conversion rate is invalid', () => {
    expect(estimateModelInvocationCost('nova-micro', undefined, 10, 150)).toBeUndefined();
    expect(estimateModelInvocationCost('nova-micro', -1, 10, 150)).toBeUndefined();
    expect(estimateModelInvocationCost('nova-micro', 10, 10, 0)).toBeUndefined();
  });
});
