import { BookOpen, ExternalLink, Globe2 } from 'lucide-react';
import type { TrustedSource } from '../../shared/api-schema';

export function SourceDetails({ sources }: { sources: TrustedSource[] }) {
  if (sources.length === 0) return null;

  return (
    <details className="source-details">
      <summary>参照元 {sources.length}件</summary>
      <ol>
        {sources.map((source, index) => (
          <li key={`${source.type}-${source.uri ?? source.title}-${index}`}>
            <span className="source-kind" aria-label={source.type === 'web' ? 'Web' : 'RAG'}>
              {source.type === 'web' ? <Globe2 size={13} /> : <BookOpen size={13} />}
            </span>
            <div>
              {source.uri?.startsWith('http') ? (
                <a href={source.uri} target="_blank" rel="noreferrer">
                  {source.title} <ExternalLink size={11} aria-hidden="true" />
                </a>
              ) : <strong>{source.title}</strong>}
              {source.excerpt && <p>{source.excerpt}</p>}
            </div>
          </li>
        ))}
      </ol>
    </details>
  );
}
