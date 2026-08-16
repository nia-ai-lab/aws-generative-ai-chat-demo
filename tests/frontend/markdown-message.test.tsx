import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MarkdownMessage } from '../../src/components/MarkdownMessage';

describe('MarkdownMessage', () => {
  it('renders GitHub-flavored Markdown elements', () => {
    const html = renderToStaticMarkup(
      <MarkdownMessage content={'## 見出し\n\n- 項目\n\n| 列 | 値 |\n| --- | --- |\n| A | `code` |'} />,
    );

    expect(html).toContain('<h2>見出し</h2>');
    expect(html).toContain('<li>項目</li>');
    expect(html).toContain('<table>');
    expect(html).toContain('<code>code</code>');
  });

  it('does not interpret raw HTML from the model', () => {
    const html = renderToStaticMarkup(
      <MarkdownMessage content={'<script>alert("unsafe")</script>\n\n[外部リンク](https://example.com)'} />,
    );

    expect(html).not.toContain('<script>');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });
});
