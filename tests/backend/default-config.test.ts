import { describe, expect, it } from 'vitest';
import { defaultConfig, migrateModelSelection } from '../../amplify/functions/shared/config.js';

describe('default application config', () => {
  it('starts with no app default prompt', () => {
    expect(defaultConfig().defaultSystemPrompt).toBe('');
    expect(defaultConfig().participantAccessEnabled).toBe(true);
    expect(defaultConfig().requiredGuardrailKeys).toEqual([]);
    expect(defaultConfig().usdToJpyRate).toBe(150);
    expect(defaultConfig().enabledToolKeys).toEqual(['web-search', 'rag', 'product-rag']);
  });
});

describe('stored model selection migration', () => {
  it('maps the retired Claude Sonnet 5 key to Claude Sonnet 5.5', () => {
    expect(migrateModelSelection('claude-sonnet-5', ['nova-pro', 'claude-sonnet-5'])).toEqual({
      defaultModelKey: 'claude-sonnet-5-5',
      enabledModelKeys: ['nova-pro', 'claude-sonnet-5-5'],
    });
  });

  it('keeps a valid default and drops unknown or duplicate keys', () => {
    expect(migrateModelSelection('nova-pro', ['nova-pro', 'retired-model', 'claude-sonnet-5', 'claude-sonnet-5-5']))
      .toEqual({ defaultModelKey: 'nova-pro', enabledModelKeys: ['nova-pro', 'claude-sonnet-5-5'] });
  });

  it('falls back to the catalog when nothing valid is stored', () => {
    expect(migrateModelSelection('retired-model', ['retired-model'])).toEqual({
      defaultModelKey: 'claude-sonnet-5-5',
      enabledModelKeys: ['claude-sonnet-5-5', 'claude-haiku-5-5', 'nova-micro', 'nova-2-lite', 'nova-pro'],
    });
  });
});
