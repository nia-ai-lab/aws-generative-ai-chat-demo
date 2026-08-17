import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { UsageCostDetails } from '../../src/components/UsageCostDetails';

describe('UsageCostDetails', () => {
  it('renders a closed disclosure with token counts and an estimated model cost', () => {
    const html = renderToStaticMarkup(
      <UsageCostDetails
        modelLabel="Nova Micro"
        usage={{
          inputTokens: 1_000,
          outputTokens: 500,
          estimate: {
            modelKey: 'nova-micro',
            currency: 'JPY',
            inputCostJpy: 0.0063,
            outputCostJpy: 0.0126,
            totalCostJpy: 0.0189,
            inputUsdPerMillionTokens: 0.042,
            outputUsdPerMillionTokens: 0.168,
            usdToJpyRate: 150,
            priceVerifiedAt: '2026-08-17',
            scope: 'MODEL_INFERENCE_ONLY',
          },
        }}
      />,
    );

    expect(html).toContain('<details class="usage-cost-details">');
    expect(html).not.toContain('<details class="usage-cost-details" open="">');
    expect(html).toContain('利用量・モデル推論料金（概算）');
    expect(html).toContain('Input 1,000 tokens');
    expect(html).toContain('Output 500 tokens');
    expect(html).toContain('¥0.0189');
    expect(html).toContain('1 USD = ¥150');
    expect(html).toContain('モデル推論のみ');
  });

  it('renders nothing when a cost estimate is unavailable', () => {
    expect(renderToStaticMarkup(
      <UsageCostDetails modelLabel="Nova Micro" usage={{ inputTokens: 10, outputTokens: 5 }} />,
    )).toBe('');
  });
});
