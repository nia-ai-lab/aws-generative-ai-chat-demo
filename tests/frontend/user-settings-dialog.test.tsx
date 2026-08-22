import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { UserSettingsDialog } from '../../src/components/UserSettingsDialog';

describe('UserSettingsDialog', () => {
  it('shows participant-level generation settings with current defaults', () => {
    const html = renderToStaticMarkup(
      <UserSettingsDialog
        open
        value=""
        generationConfig={{ temperature: 0.3, topP: null, maxOutputTokens: 1_024 }}
        guardrailKeys={['denied-topic-travel', 'blocked-word-pineapple']}
        requiredGuardrailKeys={['content-safety', 'prompt-attack']}
        toolKeys={['rag']}
        availableToolKeys={['web-search', 'rag']}
        onClose={() => undefined}
        onSave={() => undefined}
      />,
    );
    expect(html).toContain('Temperature');
    expect(html).toContain('value="0.3"');
    expect(html).toContain('Top P');
    expect(html).toContain('placeholder="モデル既定"');
    expect(html).toContain('最大アウトプットトークン');
    expect(html).toContain('value="1024"');
    expect(html).toContain('デフォルトに戻す');
    expect(html).toContain('reset-button');
    expect(html).toContain('Guardrail');
    expect(html).toContain('禁止トピック: 旅行');
    expect(html).toContain('禁止ワード: pineapple');
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('管理者必須: コンテンツ保護 / プロンプト攻撃対策');
    expect(html).toContain('Web検索');
    expect(html).toContain('RAG（社内規定検索）');
  });
});
