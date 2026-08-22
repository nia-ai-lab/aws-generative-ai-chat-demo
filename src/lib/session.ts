import {
  DEFAULT_GENERATION_CONFIG,
  generationConfigSchema,
  type GenerationConfig,
} from '../../shared/generation-config';
import {
  DEFAULT_GUARDRAIL_KEYS,
  guardrailKeySchema,
  guardrailPolicyKeysSchema,
  type GuardrailPolicyKey,
} from '../../shared/guardrail-catalog';
import {
  DEFAULT_PARTICIPANT_TOOL_KEYS,
  toolKeysSchema,
  type ToolKey,
} from '../../shared/tool-catalog';

const BROWSER_SESSION_KEY = 'genai-chat.browser-session-id';
const CONVERSATION_SESSION_KEY = 'genai-chat.conversation-session-id';
const USER_PROMPT_KEY = 'genai-chat.user-system-prompt';
const GENERATION_CONFIG_KEY = 'genai-chat.generation-config';
const GUARDRAIL_KEYS_KEY = 'genai-chat.guardrail-keys';
const LEGACY_GUARDRAIL_KEY = 'genai-chat.guardrail-key';
const TOOL_KEYS_KEY = 'genai-chat.tool-keys';

function getOrCreateUuid(key: string): string {
  const current = sessionStorage.getItem(key);
  if (current) return current;
  const value = crypto.randomUUID();
  sessionStorage.setItem(key, value);
  return value;
}

export function getBrowserSessionId(): string {
  return getOrCreateUuid(BROWSER_SESSION_KEY);
}

export function getConversationSessionId(): string {
  return getOrCreateUuid(CONVERSATION_SESSION_KEY);
}

export function resetConversationSessionId(): string {
  const value = crypto.randomUUID();
  sessionStorage.setItem(CONVERSATION_SESSION_KEY, value);
  return value;
}

export function getUserSystemPrompt(): string {
  return sessionStorage.getItem(USER_PROMPT_KEY) ?? '';
}

export function setUserSystemPrompt(value: string): void {
  sessionStorage.setItem(USER_PROMPT_KEY, value);
}

export function getGenerationConfig(): GenerationConfig {
  const stored = sessionStorage.getItem(GENERATION_CONFIG_KEY);
  if (!stored) return { ...DEFAULT_GENERATION_CONFIG };
  try {
    const result = generationConfigSchema.safeParse(JSON.parse(stored));
    return result.success ? result.data : { ...DEFAULT_GENERATION_CONFIG };
  } catch {
    return { ...DEFAULT_GENERATION_CONFIG };
  }
}

export function setGenerationConfig(value: GenerationConfig): void {
  sessionStorage.setItem(GENERATION_CONFIG_KEY, JSON.stringify(generationConfigSchema.parse(value)));
}

export function getGuardrailKeys(): GuardrailPolicyKey[] {
  const stored = sessionStorage.getItem(GUARDRAIL_KEYS_KEY);
  if (stored) {
    try {
      const result = guardrailPolicyKeysSchema.safeParse(JSON.parse(stored));
      if (result.success) return result.data;
    } catch {
      // Fall through to the legacy value or defaults.
    }
  }
  const legacy = guardrailKeySchema.safeParse(sessionStorage.getItem(LEGACY_GUARDRAIL_KEY));
  if (legacy.success) {
    const migrated = legacy.data === 'none' ? [...DEFAULT_GUARDRAIL_KEYS] : [legacy.data];
    setGuardrailKeys(migrated);
    return migrated;
  }
  return [...DEFAULT_GUARDRAIL_KEYS];
}

export function setGuardrailKeys(value: GuardrailPolicyKey[]): void {
  sessionStorage.setItem(GUARDRAIL_KEYS_KEY, JSON.stringify(guardrailPolicyKeysSchema.parse(value)));
  sessionStorage.removeItem(LEGACY_GUARDRAIL_KEY);
}

export function getToolKeys(): ToolKey[] {
  const stored = sessionStorage.getItem(TOOL_KEYS_KEY);
  if (!stored) return [...DEFAULT_PARTICIPANT_TOOL_KEYS];
  try {
    const result = toolKeysSchema.safeParse(JSON.parse(stored));
    return result.success ? result.data : [...DEFAULT_PARTICIPANT_TOOL_KEYS];
  } catch {
    return [...DEFAULT_PARTICIPANT_TOOL_KEYS];
  }
}

export function setToolKeys(value: ToolKey[]): void {
  sessionStorage.setItem(TOOL_KEYS_KEY, JSON.stringify(toolKeysSchema.parse(value)));
}

export function clearBrowserSession(): void {
  sessionStorage.removeItem(BROWSER_SESSION_KEY);
  sessionStorage.removeItem(CONVERSATION_SESSION_KEY);
  sessionStorage.removeItem(USER_PROMPT_KEY);
  sessionStorage.removeItem(GENERATION_CONFIG_KEY);
  sessionStorage.removeItem(GUARDRAIL_KEYS_KEY);
  sessionStorage.removeItem(LEGACY_GUARDRAIL_KEY);
  sessionStorage.removeItem(TOOL_KEYS_KEY);
}
