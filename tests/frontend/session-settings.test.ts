import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_GENERATION_CONFIG } from '../../shared/generation-config';
import {
  getGenerationConfig,
  getGuardrailKeys,
  setGenerationConfig,
  setGuardrailKeys,
  getToolKeys,
  setToolKeys,
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

  it('stores multiple predefined guardrails only in the current browser session', () => {
    expect(getGuardrailKeys()).toEqual([]);
    setGuardrailKeys(['blocked-word-pineapple', 'denied-topic-travel']);
    expect(getGuardrailKeys()).toEqual(['blocked-word-pineapple', 'denied-topic-travel']);
    expect(localStorage.length).toBe(0);
  });

  it('migrates the former single-selection session value', () => {
    sessionStorage.setItem('genai-chat.guardrail-key', 'content-safety');
    expect(getGuardrailKeys()).toEqual(['content-safety']);
    expect(sessionStorage.getItem('genai-chat.guardrail-key')).toBeNull();
  });

  it('keeps tool opt-ins off by default and isolated to sessionStorage', () => {
    expect(getToolKeys()).toEqual([]);
    setToolKeys(['web-search', 'rag']);
    expect(getToolKeys()).toEqual(['web-search', 'rag']);
    expect(localStorage.length).toBe(0);
  });
});
