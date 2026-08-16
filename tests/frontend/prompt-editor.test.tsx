import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PromptEditor } from '../../src/components/PromptEditor';
import { insertPromptVariable } from '../../src/lib/prompt-editor';

describe('PromptEditor', () => {
  it('shows variable insertion controls instead of requiring manual typing', () => {
    const html = renderToStaticMarkup(
      <PromptEditor
        label="システムプロンプト(ペルソナ)"
        value=""
        maxLength={4_000}
        rows={7}
        onChange={() => undefined}
      />,
    );
    expect(html).toContain('システムプロンプト(ペルソナ)');
    expect(html).toContain('$DATETIME');
    expect(html).toContain('$TIMEZONE');
  });

  it('inserts a variable at the selected range', () => {
    expect(insertPromptVariable('現在はここです', 3, 5, '$DATETIME', 100)).toEqual({
      value: '現在は$DATETIMEです',
      cursor: 12,
    });
  });

  it('does not exceed the field limit', () => {
    expect(insertPromptVariable('12345', 5, 5, '$TIMEZONE', 5)).toBeUndefined();
  });
});
