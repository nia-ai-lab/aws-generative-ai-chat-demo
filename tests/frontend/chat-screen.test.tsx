import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ChatScreen } from '../../src/components/ChatScreen';

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
});
