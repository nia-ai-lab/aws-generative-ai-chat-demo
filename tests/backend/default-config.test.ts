import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../../amplify/functions/shared/config.js';

describe('default application config', () => {
  it('starts with no app default prompt', () => {
    expect(defaultConfig().defaultSystemPrompt).toBe('');
    expect(defaultConfig().requiredGuardrailKey).toBe('none');
  });
});
