import {
  effectiveGuardrailKey,
  type GuardrailKey,
} from '../../../shared/guardrail-catalog.js';

export interface GuardrailDeployment {
  guardrailId: string;
  guardrailVersion: string;
}

export interface ResolvedGuardrail extends GuardrailDeployment {
  effectiveGuardrailKey: string;
}

export function resolveGuardrail(
  requiredGuardrailKey: GuardrailKey,
  participantGuardrailKey: GuardrailKey,
  catalogJson = process.env.GUARDRAIL_CATALOG_JSON,
): ResolvedGuardrail {
  const effectiveKey = effectiveGuardrailKey(requiredGuardrailKey, participantGuardrailKey);
  if (effectiveKey === 'none') {
    return { effectiveGuardrailKey: effectiveKey, guardrailId: '', guardrailVersion: '' };
  }
  if (!catalogJson) throw new Error('GUARDRAIL_CATALOG_UNAVAILABLE');
  const catalog = JSON.parse(catalogJson) as Record<string, Partial<GuardrailDeployment>>;
  const deployment = catalog[effectiveKey];
  if (!deployment?.guardrailId || !deployment.guardrailVersion) {
    throw new Error('GUARDRAIL_CATALOG_UNAVAILABLE');
  }
  return {
    effectiveGuardrailKey: effectiveKey,
    guardrailId: deployment.guardrailId,
    guardrailVersion: deployment.guardrailVersion,
  };
}
