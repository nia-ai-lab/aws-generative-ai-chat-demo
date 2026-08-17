import { describe, expect, it } from 'vitest';
import { estimateWebSearchCostJpy } from '../../shared/tool-pricing.js';

describe('Web Search pricing', () => {
  it('includes the managed search query and Gateway invocation charges', () => {
    expect(estimateWebSearchCostJpy(1, 150)).toBe(1.05075);
    expect(estimateWebSearchCostJpy(2, 150)).toBe(2.1015);
  });
});
