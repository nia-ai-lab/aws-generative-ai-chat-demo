import { describe, expect, it } from 'vitest';
import { resolveGuardrail } from '../../amplify/functions/shared/guardrails.js';
import { effectiveGuardrailKey } from '../../shared/guardrail-catalog.js';

const deployments = JSON.stringify({
  'content-safety': { guardrailId: 'content-id', guardrailVersion: '1' },
  'content-safety+prompt-attack': { guardrailId: 'combined-id', guardrailVersion: '2' },
});

describe('guardrail resolution', () => {
  it('uses no guardrail by default', () => {
    expect(resolveGuardrail('none', 'none', deployments)).toEqual({
      effectiveGuardrailKey: 'none',
      guardrailId: '',
      guardrailVersion: '',
    });
  });

  it('does not let the participant remove the required guardrail', () => {
    expect(resolveGuardrail('content-safety', 'none', deployments)).toEqual({
      effectiveGuardrailKey: 'content-safety',
      guardrailId: 'content-id',
      guardrailVersion: '1',
    });
  });

  it('combines required and participant policies in catalog order', () => {
    expect(effectiveGuardrailKey('prompt-attack', 'content-safety'))
      .toBe('content-safety+prompt-attack');
    expect(resolveGuardrail('prompt-attack', 'content-safety', deployments).guardrailId)
      .toBe('combined-id');
  });
});
