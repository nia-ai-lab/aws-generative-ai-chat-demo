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
          participantAccessEnabled: true,
          defaultModelKey: 'claude-sonnet-5-5',
          enabledModelKeys: ['claude-sonnet-5-5', 'nova-2-lite'],
          defaultSystemPrompt: '',
          requiredGuardrailKeys: ['content-safety', 'prompt-attack'],
          enabledToolKeys: ['web-search', 'rag', 'product-rag'],
          usdToJpyRate: 150,
          updatedAt: '2026-08-17T00:00:00.000Z',
          updatedBy: 'admin',
        }}
        onClose={() => undefined}
        onSave={async () => undefined}
      />,
    );

    expect(html).toContain('必須Guardrail');
    expect((html.match(/type="checkbox"/g) ?? [])).toHaveLength(14);
    expect(html).toContain('受講者の利用');
    expect(html).toContain('利用を許可');
    expect(html).toContain('Nova Micro');
    expect(html).toContain('コンテンツ保護');
    expect(html).toContain('禁止ワード: pineapple');
    expect(html).toContain('USD/JPY換算レート');
    expect(html).toContain('value="150"');
    expect(html).toContain('利用可能なツール');
    expect(html).toContain('dialog-header-actions');
    expect((html.match(/>キャンセル<\/button>/g) ?? [])).toHaveLength(2);
    expect((html.match(/>適用<\/button>/g) ?? [])).toHaveLength(2);
    expect(html).not.toContain('aria-label="閉じる"');
  });
});
