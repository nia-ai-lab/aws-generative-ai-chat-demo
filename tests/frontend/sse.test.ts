import { describe, expect, it } from 'vitest';
import { parseSseBlock } from '../../src/lib/sse';

describe('parseSseBlock', () => {
  it('parses a delta event', () => {
    expect(parseSseBlock('data: {"type":"delta","text":"こんにちは"}')).toEqual({
      type: 'delta',
      text: 'こんにちは',
    });
  });

  it('ignores blocks without data', () => {
    expect(parseSseBlock(': keep-alive')).toBeUndefined();
  });

  it('preserves token usage and the server-calculated estimate', () => {
    expect(parseSseBlock(`data: ${JSON.stringify({
      type: 'done',
      finishReason: 'end_turn',
      usage: {
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
      },
    })}`)).toMatchObject({
      type: 'done',
      usage: { inputTokens: 1_000, outputTokens: 500, estimate: { totalCostJpy: 0.0189 } },
    });
  });
});
