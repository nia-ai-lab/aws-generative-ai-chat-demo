import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { ChatScreen } from '../../src/components/ChatScreen';

const apiMocks = vi.hoisted(() => ({
  getConfig: vi.fn(),
  streamChat: vi.fn(),
}));

vi.mock('../../src/lib/api', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../src/lib/api')>(),
  getConfig: apiMocks.getConfig,
  streamChat: apiMocks.streamChat,
}));

beforeAll(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  Element.prototype.scrollIntoView = vi.fn();
});

describe('ChatScreen', () => {
  it('places the chat clear action in the header and removes the composer clear action', () => {
    const html = renderToStaticMarkup(
      <ChatScreen
        config={{
          configVersion: 1,
          defaultModelKey: 'nova-micro',
          models: [{ key: 'nova-micro', label: 'Nova Micro' }],
          requiredGuardrailKeys: [],
          availableToolKeys: [],
        }}
        isAdmin={false}
        onConfigChange={() => undefined}
        onSignOut={async () => undefined}
      />,
    );

    expect(html).toContain('class="chat-clear-button"');
    expect(html).toContain('チャットクリア');
    expect(html).not.toContain('class="clear-button"');
    expect(html).toContain('class="header-icon-actions"');
  });

  it('allows the chat input to grow from one row up to twenty rows', () => {
    const html = renderToStaticMarkup(
      <ChatScreen
        config={{
          configVersion: 1,
          defaultModelKey: 'nova-micro',
          models: [{ key: 'nova-micro', label: 'Nova Micro' }],
          requiredGuardrailKeys: [],
          availableToolKeys: [],
        }}
        isAdmin={false}
        onConfigChange={() => undefined}
        onSignOut={async () => undefined}
      />,
    );
    const styles = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');

    expect(html).toContain('<textarea rows="1"');
    expect(styles).toMatch(/\.composer textarea\s*{[^}]*max-height:\s*calc\(20 \* 1\.55em \+ 16px\)/s);
    expect(styles).toMatch(/\.composer textarea\s*{[^}]*overflow-y:\s*auto/s);
  });

  it('refreshes the available models without delaying chat clear', async () => {
    const latestConfig = {
      configVersion: 2,
      defaultModelKey: 'nova-2-lite' as const,
      models: [{ key: 'nova-2-lite' as const, label: 'Nova 2 Lite' }],
      requiredGuardrailKeys: [],
      availableToolKeys: [],
    };
    apiMocks.getConfig.mockResolvedValueOnce(latestConfig);
    apiMocks.streamChat.mockImplementationOnce(async function* () {
      yield { type: 'done', finishReason: 'stop' };
    });
    const onConfigChange = vi.fn();
    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <ChatScreen
          config={{
            configVersion: 1,
            defaultModelKey: 'nova-micro',
            models: [{ key: 'nova-micro', label: 'Nova Micro' }],
            requiredGuardrailKeys: [],
            availableToolKeys: [],
          }}
          isAdmin={false}
          onConfigChange={onConfigChange}
          onSignOut={async () => undefined}
        />,
      );
    });

    const textarea = container.querySelector<HTMLTextAreaElement>('textarea[aria-label="メッセージ"]');
    const sendButton = container.querySelector<HTMLButtonElement>('.send-button');
    expect(textarea).not.toBeNull();
    expect(sendButton).not.toBeNull();
    await act(async () => {
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
      valueSetter?.call(textarea, 'モデル設定を更新');
      textarea!.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => {
      sendButton!.click();
      await Promise.resolve();
    });

    const clearButton = container.querySelector<HTMLButtonElement>('.chat-clear-button');
    expect(clearButton).not.toBeNull();
    expect(clearButton!.disabled).toBe(false);
    await act(async () => {
      clearButton!.click();
      await Promise.resolve();
    });

    expect(apiMocks.getConfig).toHaveBeenCalledOnce();
    expect(onConfigChange).toHaveBeenCalledWith(latestConfig);

    await act(async () => root.unmount());
  });
});
