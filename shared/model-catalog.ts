export const MODEL_CATALOG = {
  'claude-sonnet-5': {
    key: 'claude-sonnet-5',
    label: 'Claude Sonnet 5',
    inferenceProfileId: 'global.anthropic.claude-sonnet-5',
  },
  'nova-micro': {
    key: 'nova-micro',
    label: 'Nova Micro',
    inferenceProfileId: 'apac.amazon.nova-micro-v1:0',
  },
  'nova-2-lite': {
    key: 'nova-2-lite',
    label: 'Nova 2 Lite',
    inferenceProfileId: 'jp.amazon.nova-2-lite-v1:0',
  },
  'nova-pro': {
    key: 'nova-pro',
    label: 'Nova Pro',
    inferenceProfileId: 'apac.amazon.nova-pro-v1:0',
  },
} as const;

export type ModelKey = keyof typeof MODEL_CATALOG;

export const MODEL_KEYS = Object.keys(MODEL_CATALOG) as ModelKey[];
export const DEFAULT_MODEL_KEY: ModelKey = 'claude-sonnet-5';

export const PUBLIC_MODELS = MODEL_KEYS.map((key) => ({
  key,
  label: MODEL_CATALOG[key].label,
}));

export function isModelKey(value: string): value is ModelKey {
  return Object.hasOwn(MODEL_CATALOG, value);
}
