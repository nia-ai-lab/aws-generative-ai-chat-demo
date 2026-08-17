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

  it('renders thinking blocks as collapsed Markdown details', () => {
    const html = renderToStaticMarkup(
      <MarkdownMessage content={'<thinking>**確認中**\n\n- 手順1</thinking>\n\n回答です。'} />,
    );

    expect(html).toContain('<details class="thinking-details">');
    expect(html).not.toContain('<details class="thinking-details" open="">');
    expect(html).toContain('<summary>AI Thinking</summary>');
    expect(html).toContain('<strong>確認中</strong>');
    expect(html).toContain('<li>手順1</li>');
    expect(html).toContain('<p>回答です。</p>');
    expect(html).not.toContain('&lt;thinking&gt;');
    expect(html).not.toContain('&lt;/thinking&gt;');
  });

  it('keeps an incomplete streamed thinking block collapsed', () => {
    const html = renderToStaticMarkup(
      <MarkdownMessage content={'<THINKING>まだ検討中'} />,
    );

    expect(html).toContain('<details class="thinking-details">');
    expect(html).toContain('まだ検討中');
    expect(html).not.toContain('&lt;THINKING&gt;');
  });
});
