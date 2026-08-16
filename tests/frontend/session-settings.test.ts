import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_GENERATION_CONFIG } from '../../shared/generation-config';
import {
  getGenerationConfig,
  getGuardrailKey,
  setGenerationConfig,
  setGuardrailKey,
} from '../../src/lib/session';

describe('participant generation settings', () => {
  beforeEach(() => sessionStorage.clear());

  it('uses the existing application defaults initially', () => {
    expect(getGenerationConfig()).toEqual(DEFAULT_GENERATION_CONFIG);
  });

  it('stores settings only in the current browser session', () => {
    setGenerationConfig({ temperature: 0.8, topP: 0.9, maxOutputTokens: 2_048 });
    expect(getGenerationConfig()).toEqual({ temperature: 0.8, topP: 0.9, maxOutputTokens: 2_048 });
    expect(localStorage.length).toBe(0);
  });

  it('falls back safely when browser data is invalid', () => {
    sessionStorage.setItem('genai-chat.generation-config', '{broken');
    expect(getGenerationConfig()).toEqual(DEFAULT_GENERATION_CONFIG);
  });

  it('stores a predefined guardrail only in the current browser session', () => {
    expect(getGuardrailKey()).toBe('none');
    setGuardrailKey('blocked-word-pineapple');
    expect(getGuardrailKey()).toBe('blocked-word-pineapple');
    expect(localStorage.length).toBe(0);
  });
});
