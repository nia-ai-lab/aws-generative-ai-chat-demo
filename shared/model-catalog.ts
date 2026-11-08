export const MODEL_CATALOG = {
  'claude-sonnet-5-5': {
    key: 'claude-sonnet-5-5',
    label: 'Claude Sonnet 5.5',
    inferenceProfileId: 'global.anthropic.claude-sonnet-5-5',
    // Claude Sonnet 5 and later reject non-default temperature and any top_p.
    supportsSamplingParameters: false,
  },
  'claude-haiku-5-5': {
    key: 'claude-haiku-5-5',
    label: 'Claude Haiku 5.5',
    inferenceProfileId: 'global.anthropic.claude-haiku-5-5',
    supportsSamplingParameters: false,
  },
  'nova-micro': {
    key: 'nova-micro',
    label: 'Nova Micro',
    inferenceProfileId: 'apac.amazon.nova-micro-v1:0',
    supportsSamplingParameters: true,
  },
  'nova-2-lite': {
    key: 'nova-2-lite',
    label: 'Nova 2 Lite',
    inferenceProfileId: 'jp.amazon.nova-2-lite-v1:0',
    supportsSamplingParameters: true,
  },
  'nova-pro': {
    key: 'nova-pro',
    label: 'Nova Pro',
    inferenceProfileId: 'apac.amazon.nova-pro-v1:0',
    supportsSamplingParameters: true,
  },
} as const;

export type ModelKey = keyof typeof MODEL_CATALOG;

export const MODEL_KEYS = Object.keys(MODEL_CATALOG) as ModelKey[];
export const DEFAULT_MODEL_KEY: ModelKey = 'claude-sonnet-5-5';

// Model keys persisted by earlier releases, mapped to their current replacement.
export const LEGACY_MODEL_KEY_ALIASES: Readonly<Record<string, ModelKey>> = {
  'claude-sonnet-5': 'claude-sonnet-5-5',
};

export const PUBLIC_MODELS = MODEL_KEYS.map((key) => ({
  key,
  label: MODEL_CATALOG[key].label,
}));

export function isModelKey(value: string): value is ModelKey {
  return Object.hasOwn(MODEL_CATALOG, value);
}

export function supportsSamplingParameters(key: ModelKey): boolean {
  return MODEL_CATALOG[key].supportsSamplingParameters;
}

/** Resolve a stored model key, migrating legacy keys and dropping unknown ones. */
export function migrateModelKey(value: unknown): ModelKey | undefined {
  if (typeof value !== 'string') return undefined;
  if (isModelKey(value)) return value;
  return LEGACY_MODEL_KEY_ALIASES[value];
}
