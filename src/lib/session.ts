import {
  DEFAULT_GENERATION_CONFIG,
  generationConfigSchema,
  type GenerationConfig,
} from '../../shared/generation-config';
import {
  DEFAULT_GUARDRAIL_KEY,
  guardrailKeySchema,
  type GuardrailKey,
} from '../../shared/guardrail-catalog';

const BROWSER_SESSION_KEY = 'genai-chat.browser-session-id';
const CONVERSATION_SESSION_KEY = 'genai-chat.conversation-session-id';
const USER_PROMPT_KEY = 'genai-chat.user-system-prompt';
const GENERATION_CONFIG_KEY = 'genai-chat.generation-config';
const GUARDRAIL_KEY = 'genai-chat.guardrail-key';

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

export function getGuardrailKey(): GuardrailKey {
  const result = guardrailKeySchema.safeParse(sessionStorage.getItem(GUARDRAIL_KEY));
  return result.success ? result.data : DEFAULT_GUARDRAIL_KEY;
}

export function setGuardrailKey(value: GuardrailKey): void {
  sessionStorage.setItem(GUARDRAIL_KEY, guardrailKeySchema.parse(value));
}

export function clearBrowserSession(): void {
  sessionStorage.removeItem(BROWSER_SESSION_KEY);
  sessionStorage.removeItem(CONVERSATION_SESSION_KEY);
  sessionStorage.removeItem(USER_PROMPT_KEY);
  sessionStorage.removeItem(GENERATION_CONFIG_KEY);
  sessionStorage.removeItem(GUARDRAIL_KEY);
}
