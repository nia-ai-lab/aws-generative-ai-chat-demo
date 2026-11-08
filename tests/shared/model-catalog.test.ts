import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MODEL_KEY,
  MODEL_CATALOG,
  MODEL_KEYS,
  migrateModelKey,
  supportsSamplingParameters,
} from '../../shared/model-catalog.js';

describe('model catalog', () => {
  it('offers Nova Micro through its APAC cross-region inference profile', () => {
    expect(MODEL_KEYS).toContain('nova-micro');
    expect(MODEL_CATALOG['nova-micro']).toEqual({
      key: 'nova-micro',
      label: 'Nova Micro',
      inferenceProfileId: 'apac.amazon.nova-micro-v1:0',
      supportsSamplingParameters: true,
    });
  });

  it('defaults to Claude Sonnet 5.5 through its global inference profile', () => {
    expect(DEFAULT_MODEL_KEY).toBe('claude-sonnet-5-5');
    expect(MODEL_CATALOG['claude-sonnet-5-5']).toMatchObject({
      label: 'Claude Sonnet 5.5',
      inferenceProfileId: 'global.anthropic.claude-sonnet-5-5',
    });
    expect(MODEL_KEYS).not.toContain('claude-sonnet-5');
  });

  it('offers Claude Haiku 5.5 through its global inference profile', () => {
    expect(MODEL_CATALOG['claude-haiku-5-5']).toMatchObject({
      label: 'Claude Haiku 5.5',
      inferenceProfileId: 'global.anthropic.claude-haiku-5-5',
    });
  });

  it('marks Claude 5.5 models as rejecting temperature and top_p', () => {
    expect(supportsSamplingParameters('claude-sonnet-5-5')).toBe(false);
    expect(supportsSamplingParameters('claude-haiku-5-5')).toBe(false);
    expect(supportsSamplingParameters('nova-2-lite')).toBe(true);
  });

  it('migrates the retired Claude Sonnet 5 key', () => {
    expect(migrateModelKey('claude-sonnet-5')).toBe('claude-sonnet-5-5');
    expect(migrateModelKey('nova-pro')).toBe('nova-pro');
    expect(migrateModelKey('unknown')).toBeUndefined();
    expect(migrateModelKey(42)).toBeUndefined();
  });
});
