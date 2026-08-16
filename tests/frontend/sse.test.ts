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
});
