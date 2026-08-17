import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SourceDetails } from '../../src/components/SourceDetails';

describe('SourceDetails', () => {
  it('renders Web links and RAG document titles in a closed disclosure', () => {
    const html = renderToStaticMarkup(<SourceDetails sources={[
      { type: 'web', title: 'AWS News', uri: 'https://aws.amazon.com/news/', excerpt: '最新情報' },
      { type: 'rag', title: '生成AI利用規程', excerpt: '架空の規定' },
    ]} />);

    expect(html).toContain('参照元 2件');
    expect(html).toContain('href="https://aws.amazon.com/news/"');
    expect(html).toContain('生成AI利用規程');
    expect(html).not.toContain('<details class="source-details" open');
  });
});
