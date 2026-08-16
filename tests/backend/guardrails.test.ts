import { describe, expect, it } from 'vitest';
import { resolveGuardrail } from '../../amplify/functions/shared/guardrails.js';
import { effectiveGuardrailKey } from '../../shared/guardrail-catalog.js';

const deployments = JSON.stringify({
  'content-safety': { guardrailId: 'content-id', guardrailVersion: '1' },
  'content-safety+prompt-attack': { guardrailId: 'combined-id', guardrailVersion: '2' },
  'content-safety+prompt-attack+sensitive-information': {
    guardrailId: 'triple-id',
    guardrailVersion: '3',
  },
});

describe('guardrail resolution', () => {
  it('uses no guardrail by default', () => {
    expect(resolveGuardrail([], [], deployments)).toEqual({
      effectiveGuardrailKey: 'none',
      guardrailId: '',
      guardrailVersion: '',
    });
  });

  it('does not let the participant remove the required guardrail', () => {
    expect(resolveGuardrail(['content-safety'], [], deployments)).toEqual({
      effectiveGuardrailKey: 'content-safety',
      guardrailId: 'content-id',
      guardrailVersion: '1',
    });
  });

  it('combines required and participant policies in catalog order', () => {
    expect(effectiveGuardrailKey(
      ['prompt-attack', 'sensitive-information'],
      ['content-safety', 'prompt-attack'],
    )).toBe('content-safety+prompt-attack+sensitive-information');
    expect(resolveGuardrail(
      ['prompt-attack', 'sensitive-information'],
      ['content-safety'],
      deployments,
    ).guardrailId).toBe('triple-id');
  });
});
