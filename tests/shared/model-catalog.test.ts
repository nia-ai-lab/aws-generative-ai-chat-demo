import { describe, expect, it } from 'vitest';
import { MODEL_CATALOG, MODEL_KEYS } from '../../shared/model-catalog.js';

describe('model catalog', () => {
  it('offers Nova Micro through its APAC cross-region inference profile', () => {
    expect(MODEL_KEYS).toContain('nova-micro');
    expect(MODEL_CATALOG['nova-micro']).toEqual({
      key: 'nova-micro',
      label: 'Nova Micro',
      inferenceProfileId: 'apac.amazon.nova-micro-v1:0',
    });
  });
});
