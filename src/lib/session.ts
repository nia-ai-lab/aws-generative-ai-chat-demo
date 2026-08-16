const BROWSER_SESSION_KEY = 'genai-chat.browser-session-id';
const CONVERSATION_SESSION_KEY = 'genai-chat.conversation-session-id';
const USER_PROMPT_KEY = 'genai-chat.user-system-prompt';

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

export function clearBrowserSession(): void {
  sessionStorage.removeItem(BROWSER_SESSION_KEY);
  sessionStorage.removeItem(CONVERSATION_SESSION_KEY);
  sessionStorage.removeItem(USER_PROMPT_KEY);
}
