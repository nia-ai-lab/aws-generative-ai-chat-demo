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
          updatedAt: '2026-08-17T00:00:00.000Z',
          updatedBy: 'admin',
        }}
        onClose={() => undefined}
        onSave={async () => undefined}
      />,
    );

    expect(html).toContain('必須Guardrail');
    expect((html.match(/type="checkbox"/g) ?? [])).toHaveLength(8);
    expect(html).toContain('コンテンツ保護');
    expect(html).toContain('禁止ワード: pineapple');
  });
});
