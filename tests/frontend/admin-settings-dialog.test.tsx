import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AdminSettingsDialog } from '../../src/components/AdminSettingsDialog';

describe('AdminSettingsDialog', () => {
  it('shows multiple required Guardrail checkboxes', () => {
    const html = renderToStaticMarkup(
      <AdminSettingsDialog
        open
        loading={false}
        error=""
        config={{
          configVersion: 2,
          defaultModelKey: 'claude-sonnet-5',
          enabledModelKeys: ['claude-sonnet-5', 'nova-2-lite'],
          defaultSystemPrompt: '',
          requiredGuardrailKeys: ['content-safety', 'prompt-attack'],
          defaultToolKeys: [],
          usdToJpyRate: 150,
          updatedAt: '2026-08-17T00:00:00.000Z',
          updatedBy: 'admin',
        }}
        onClose={() => undefined}
        onSave={async () => undefined}
      />,
    );

    expect(html).toContain('必須Guardrail');
    expect((html.match(/type="checkbox"/g) ?? [])).toHaveLength(11);
    expect(html).toContain('Nova Micro');
    expect(html).toContain('コンテンツ保護');
    expect(html).toContain('禁止ワード: pineapple');
    expect(html).toContain('USD/JPY換算レート');
    expect(html).toContain('value="150"');
    expect(html).toContain('ツール設定');
    expect(html).toContain('新しいブラウザセッションで、最初からオンにするツールを選択します。');
    expect(html).not.toContain('利用可能なツール');
    const toolSettingsHtml = html.slice(html.indexOf('ツール設定'), html.indexOf('USD/JPY換算レート'));
    expect(toolSettingsHtml).not.toContain('checked=""');
  });
});
