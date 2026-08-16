import { z } from 'zod';

export const GUARDRAIL_KEYS = [
  'none',
  'content-safety',
  'prompt-attack',
  'sensitive-information',
  'denied-topic-travel',
  'blocked-word-pineapple',
] as const;

export const GUARDRAIL_POLICY_KEYS = [
  'content-safety',
  'prompt-attack',
  'sensitive-information',
  'denied-topic-travel',
  'blocked-word-pineapple',
] as const;

export type GuardrailKey = (typeof GUARDRAIL_KEYS)[number];
export type GuardrailPolicyKey = (typeof GUARDRAIL_POLICY_KEYS)[number];
export const guardrailKeySchema = z.enum(GUARDRAIL_KEYS);
export const guardrailPolicyKeySchema = z.enum(GUARDRAIL_POLICY_KEYS);
export const guardrailPolicyKeysSchema = z.array(guardrailPolicyKeySchema)
  .max(GUARDRAIL_POLICY_KEYS.length)
  .refine((keys) => new Set(keys).size === keys.length, 'Guardrail policies must be unique.');
export const DEFAULT_GUARDRAIL_KEYS: GuardrailPolicyKey[] = [];

export const GUARDRAIL_CATALOG: Record<GuardrailKey, {
  label: string;
  description: string;
}> = {
  none: {
    label: 'なし',
    description: 'Bedrock Guardrailsを適用しません。',
  },
  'content-safety': {
    label: 'コンテンツ保護',
    description: '有害、侮辱、性的、暴力、違法行為に関する内容を検出します。',
  },
  'prompt-attack': {
    label: 'プロンプト攻撃対策',
    description: '指示の上書きやジェイルブレイクを目的とする入力を検出します。',
  },
  'sensitive-information': {
    label: '個人情報の匿名化',
    description: 'メールアドレスと電話番号を匿名化します。架空の情報で試してください。',
  },
  'denied-topic-travel': {
    label: '禁止トピック: 旅行',
    description: '旅行、観光、宿泊、旅程に関する話題を拒否します。',
  },
  'blocked-word-pineapple': {
    label: '禁止ワード: pineapple',
    description: '英単語「pineapple」を含む入力や出力を拒否します。',
  },
};

export function activeGuardrailPolicies(
  requiredGuardrailKeys: readonly GuardrailPolicyKey[],
  participantGuardrailKeys: readonly GuardrailPolicyKey[],
): GuardrailPolicyKey[] {
  const selected = new Set([...requiredGuardrailKeys, ...participantGuardrailKeys]);
  return GUARDRAIL_POLICY_KEYS.filter((key) => selected.has(key));
}

export function effectiveGuardrailKey(
  requiredGuardrailKeys: readonly GuardrailPolicyKey[],
  participantGuardrailKeys: readonly GuardrailPolicyKey[],
): string {
  const policies = activeGuardrailPolicies(requiredGuardrailKeys, participantGuardrailKeys);
  return policies.length === 0 ? 'none' : policies.join('+');
}
