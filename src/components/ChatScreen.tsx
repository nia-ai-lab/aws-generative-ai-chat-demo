import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { LogOut, Send, Settings, Shield, Trash2 } from 'lucide-react';
import type { AdminConfig, PublicConfig, UpdateAdminConfig } from '../../shared/api-schema';
import type { GenerationConfig } from '../../shared/generation-config';
import type { GuardrailPolicyKey } from '../../shared/guardrail-catalog';
import { MODEL_CATALOG, type ModelKey } from '../../shared/model-catalog';
import { safeErrorMessage } from '../../shared/errors';
import { getAdminConfig, streamChat, updateAdminConfig } from '../lib/api';
import { shouldSendOnKeyDown } from '../lib/keyboard';
import { getBrowserTimeZone } from '../lib/time-zone';
import {
  getBrowserSessionId,
  getConversationSessionId,
  getGenerationConfig,
  getGuardrailKeys,
  getUserSystemPrompt,
  resetConversationSessionId,
  setGenerationConfig,
  setGuardrailKeys,
  setUserSystemPrompt,
} from '../lib/session';
import { AdminSettingsDialog } from './AdminSettingsDialog';
import { UserSettingsDialog } from './UserSettingsDialog';

const MarkdownMessage = lazy(() => import('./MarkdownMessage'));

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  pending?: boolean;
  error?: boolean;
}

interface ChatScreenProps {
  config: PublicConfig;
  isAdmin: boolean;
  onConfigChange: (config: PublicConfig) => void;
  onSignOut: () => Promise<void>;
}

export function ChatScreen({ config, isAdmin, onConfigChange, onSignOut }: ChatScreenProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [modelKey, setModelKey] = useState<ModelKey>(config.defaultModelKey);
  const [userPrompt, setUserPrompt] = useState(getUserSystemPrompt);
  const [generationConfig, setCurrentGenerationConfig] = useState(getGenerationConfig);
  const [guardrailKeys, setCurrentGuardrailKeys] = useState(getGuardrailKeys);
  const [sending, setSending] = useState(false);
  const [userSettingsOpen, setUserSettingsOpen] = useState(false);
  const [adminSettingsOpen, setAdminSettingsOpen] = useState(false);
  const [adminConfig, setAdminConfig] = useState<AdminConfig>();
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState('');
  const abortRef = useRef<AbortController | undefined>(undefined);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useLayoutEffect(() => {
    const textarea = inputRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [input]);

  const selectedModelKey = config.models.some((model) => model.key === modelKey)
    ? modelKey
    : config.defaultModelKey;

  async function sendMessage() {
    const message = input.trim();
    if (!message || sending) return;

    const requestId = crypto.randomUUID();
    const assistantId = crypto.randomUUID();
    setInput('');
    setSending(true);
    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: 'user', text: message },
      { id: assistantId, role: 'assistant', text: 'AI Thinking...', pending: true },
    ]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      let terminalEventReceived = false;
      for await (const event of streamChat(
        {
          requestId,
          browserSessionId: getBrowserSessionId(),
          conversationSessionId: getConversationSessionId(),
          modelKey: selectedModelKey,
          message,
          userSystemPrompt: userPrompt,
          guardrailKeys,
          timeZone: getBrowserTimeZone(),
          generationConfig,
        },
        controller.signal,
      )) {
        if (event.type === 'delta') {
          setMessages((current) => current.map((item) =>
            item.id === assistantId
              ? { ...item, text: item.pending ? event.text : item.text + event.text, pending: false }
              : item,
          ));
        } else if (event.type === 'done') {
          terminalEventReceived = true;
          setMessages((current) => current.map((item) =>
            item.id === assistantId ? { ...item, pending: false } : item,
          ));
        } else if (event.type === 'error') {
          terminalEventReceived = true;
          throw new Error(event.code);
        }
      }
      if (!terminalEventReceived) throw new Error('AGENT_UNAVAILABLE');
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        const code = error instanceof Error ? error.message : 'INTERNAL_ERROR';
        setMessages((current) => current.map((item) =>
          item.id === assistantId
            ? { ...item, text: safeErrorMessage(code), pending: false, error: true }
            : item,
        ));
      }
    } finally {
      abortRef.current = undefined;
      setSending(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (shouldSendOnKeyDown({
      key: event.key,
      shiftKey: event.shiftKey,
      isComposing: event.nativeEvent.isComposing,
      keyCode: event.keyCode,
    })) {
      event.preventDefault();
      void sendMessage();
    }
  }

  function clearChat() {
    abortRef.current?.abort();
    setMessages([]);
    setSending(false);
    resetConversationSessionId();
    inputRef.current?.focus();
  }

  function saveUserPrompt(
    value: string,
    updatedGenerationConfig: GenerationConfig,
    updatedGuardrailKeys: GuardrailPolicyKey[],
  ) {
    setUserSystemPrompt(value);
    setUserPrompt(value);
    setGenerationConfig(updatedGenerationConfig);
    setCurrentGenerationConfig(updatedGenerationConfig);
    setGuardrailKeys(updatedGuardrailKeys);
    setCurrentGuardrailKeys(updatedGuardrailKeys);
    setUserSettingsOpen(false);
  }

  async function openAdminSettings() {
    setAdminSettingsOpen(true);
    setAdminLoading(true);
    setAdminError('');
    try {
      setAdminConfig(await getAdminConfig());
    } catch (error) {
      setAdminError(safeErrorMessage(error instanceof Error ? error.message : 'INTERNAL_ERROR'));
    } finally {
      setAdminLoading(false);
    }
  }

  async function saveAdminSettings(value: UpdateAdminConfig) {
    setAdminError('');
    try {
      const updated = await updateAdminConfig(value);
      setAdminConfig(updated);
      onConfigChange({
        configVersion: updated.configVersion,
        defaultModelKey: updated.defaultModelKey,
        models: updated.enabledModelKeys.map((key) => ({
          key,
          label: MODEL_CATALOG[key].label,
        })),
        requiredGuardrailKeys: updated.requiredGuardrailKeys,
      });
      setAdminSettingsOpen(false);
    } catch (error) {
      setAdminError(safeErrorMessage(error instanceof Error ? error.message : 'INTERNAL_ERROR'));
    }
  }

  return (
    <main className="chat-page">
      <header className="app-header">
        <div className="title-group">
          <div className="brand-mark small" aria-hidden="true">AI</div>
          <h1>Generative AI Chat</h1>
        </div>
        <div className="header-actions">
          <select
            className="model-select"
            aria-label="モデル"
            value={selectedModelKey}
            disabled={sending}
            onChange={(event) => setModelKey(event.target.value as ModelKey)}
          >
            {config.models.map((model) => <option key={model.key} value={model.key}>{model.label}</option>)}
          </select>
          <button className="icon-button" type="button" aria-label="設定" data-tooltip="設定" onClick={() => setUserSettingsOpen(true)}>
            <Settings size={20} />
          </button>
          {isAdmin && (
            <button className="icon-button" type="button" aria-label="管理設定" data-tooltip="管理設定" onClick={() => void openAdminSettings()}>
              <Shield size={20} />
            </button>
          )}
          <button className="icon-button" type="button" aria-label="ログアウト" data-tooltip="ログアウト" onClick={() => void onSignOut()}>
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <section className={`message-list ${messages.length === 0 ? 'empty' : ''}`} aria-live="polite">
        {messages.length === 0 && <div className="empty-mark" aria-hidden="true">AI</div>}
        {messages.map((message) => (
          <article key={message.id} className={`message ${message.role} ${message.error ? 'error' : ''}`}>
            <div className="message-label">{message.role === 'user' ? 'YOU' : 'AI'}</div>
            <div className={message.pending ? 'thinking' : ''}>
              {message.pending || message.role === 'user' || message.error
                ? message.text
                : (
                  <Suspense fallback={message.text}>
                    <MarkdownMessage content={message.text} />
                  </Suspense>
                )}
            </div>
          </article>
        ))}
        <div ref={endRef} />
      </section>

      <div className="composer-wrap">
        <div className="composer">
          <textarea
            ref={inputRef}
            rows={1}
            maxLength={8_000}
            placeholder="メッセージを入力"
            aria-label="メッセージ"
            value={input}
            disabled={sending}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button className="send-button" type="button" aria-label="送信" disabled={sending || !input.trim()} onClick={() => void sendMessage()}>
            <Send size={20} />
          </button>
        </div>
        <button className="clear-button" type="button" onClick={clearChat} disabled={messages.length === 0 && !sending}>
          <Trash2 size={16} /> クリア
        </button>
      </div>

      <UserSettingsDialog
        open={userSettingsOpen}
        value={userPrompt}
        generationConfig={generationConfig}
        guardrailKeys={guardrailKeys}
        requiredGuardrailKeys={config.requiredGuardrailKeys}
        onClose={() => setUserSettingsOpen(false)}
        onSave={saveUserPrompt}
      />
      <AdminSettingsDialog
        open={adminSettingsOpen}
        config={adminConfig}
        loading={adminLoading}
        error={adminError}
        onClose={() => setAdminSettingsOpen(false)}
        onSave={saveAdminSettings}
      />
    </main>
  );
}
