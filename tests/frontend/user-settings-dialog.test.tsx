import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { UserSettingsDialog } from '../../src/components/UserSettingsDialog';

describe('UserSettingsDialog', () => {
  it('shows participant-level generation settings with current defaults', () => {
    const html = renderToStaticMarkup(
      <UserSettingsDialog
        open
        value=""
        modelKey="nova-2-lite"
        generationConfig={{ temperature: 0.3, topP: null, maxOutputTokens: 4_096 }}
        guardrailKeys={['denied-topic-travel', 'blocked-word-pineapple']}
        requiredGuardrailKeys={['content-safety', 'prompt-attack']}
        toolKeys={['rag']}
        availableToolKeys={['web-search', 'rag', 'product-rag']}
        onClose={() => undefined}
        onSave={() => undefined}
      />,
    );
    expect(html).toContain('Temperature');
    expect(html).toContain('value="0.3"');
    expect(html).toContain('Top P');
    expect(html).toContain('placeholder="モデル既定"');
    expect(html).toContain('最大アウトプットトークン');
    expect(html).toContain('value="4096"');
    expect(html).toContain('デフォルトに戻す');
    expect(html).toContain('reset-button');
    expect(html).toContain('Guardrail');
    expect(html).toContain('禁止トピック: 旅行');
    expect(html).toContain('禁止ワード: pineapple');
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('管理者必須: コンテンツ保護 / プロンプト攻撃対策');
    expect(html).toContain('Web検索');
    expect(html).toContain('RAG（社内規定検索）');
    expect(html).toContain('RAG（製品情報検索）');
    expect(html).toContain('dialog-header-actions');
    expect((html.match(/>キャンセル<\/button>/g) ?? [])).toHaveLength(2);
    expect((html.match(/>適用<\/button>/g) ?? [])).toHaveLength(2);
    expect(html).not.toContain('aria-label="閉じる"');
    expect(html).not.toContain('Temperature と Top P の指定に対応していない');
  });

  it('shows locked presets as checked checkboxes that cannot be changed', () => {
    const html = renderToStaticMarkup(
      <UserSettingsDialog
        open
        value=""
        modelKey="nova-2-lite"
        generationConfig={{ temperature: 0.3, topP: null, maxOutputTokens: 4_096 }}
        guardrailKeys={[]}
        requiredGuardrailKeys={[]}
        lockedGuardrailKeys={['content-safety']}
        toolKeys={[]}
        availableToolKeys={[]}
        onClose={() => undefined}
        onSave={() => undefined}
      />,
    );
    const checkboxes = html.match(/<input type="checkbox"[^>]*>/g) ?? [];
    expect(checkboxes).toHaveLength(5);
    expect(checkboxes[0]).toContain('checked=""');
    expect(checkboxes[0]).toContain('disabled=""');
    expect(checkboxes.slice(1).every((checkbox) => !checkbox.includes('disabled'))).toBe(true);
  });

  it('explains that Claude Sonnet 5.5 ignores sampling parameters', () => {
    const html = renderToStaticMarkup(
      <UserSettingsDialog
        open
        value=""
        modelKey="claude-sonnet-5-5"
        generationConfig={{ temperature: 0.3, topP: null, maxOutputTokens: 4_096 }}
        guardrailKeys={[]}
        requiredGuardrailKeys={[]}
        toolKeys={[]}
        availableToolKeys={[]}
        onClose={() => undefined}
        onSave={() => undefined}
      />,
    );
    expect(html).toContain('Claude Sonnet 5.5 は Temperature と Top P の指定に対応していない');
  });
});
