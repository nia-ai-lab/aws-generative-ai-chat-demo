import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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
});
