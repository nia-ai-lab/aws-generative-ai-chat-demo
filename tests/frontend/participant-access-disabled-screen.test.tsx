import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ParticipantAccessDisabledScreen } from '../../src/components/ParticipantAccessDisabledScreen';

describe('ParticipantAccessDisabledScreen', () => {
  it('shows only the unavailable state and logout action', () => {
    const html = renderToStaticMarkup(
      <ParticipantAccessDisabledScreen onSignOut={async () => undefined} />,
    );

    expect(html).toContain('Generative AI Chat');
    expect(html).toContain('現在、このアプリは利用できません。');
    expect(html).toContain('ログアウト');
    expect(html).not.toContain('メッセージを入力');
  });
});
