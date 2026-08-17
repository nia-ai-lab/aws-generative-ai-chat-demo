import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownMessageProps {
  content: string;
}

interface MessageSegment {
  content: string;
  kind: 'answer' | 'thinking';
}

const openingTag = '<thinking>';
const closingTag = '</thinking>';

function splitThinkingSegments(content: string): MessageSegment[] {
  const normalized = content.toLowerCase();
  const segments: MessageSegment[] = [];
  let cursor = 0;

  while (cursor < content.length) {
    const openingIndex = normalized.indexOf(openingTag, cursor);
    if (openingIndex === -1) {
      segments.push({ kind: 'answer', content: content.slice(cursor) });
      break;
    }
    if (openingIndex > cursor) {
      segments.push({ kind: 'answer', content: content.slice(cursor, openingIndex) });
    }

    const thinkingStart = openingIndex + openingTag.length;
    const closingIndex = normalized.indexOf(closingTag, thinkingStart);
    if (closingIndex === -1) {
      segments.push({ kind: 'thinking', content: content.slice(thinkingStart) });
      break;
    }
    segments.push({ kind: 'thinking', content: content.slice(thinkingStart, closingIndex) });
    cursor = closingIndex + closingTag.length;
  }

  return segments.filter((segment) => segment.content.length > 0);
}

function MarkdownContent({ content }: MarkdownMessageProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ children, href }) => (
          <a href={href} target="_blank" rel="noopener noreferrer">
            {children}
          </a>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

export function MarkdownMessage({ content }: MarkdownMessageProps) {
  const segments = splitThinkingSegments(content);
  return (
    <div className="markdown-message">
      {segments.map((segment, index) => segment.kind === 'thinking' ? (
        <details className="thinking-details" key={`${segment.kind}-${index}`}>
          <summary>AI Thinking</summary>
          <div className="thinking-content">
            <MarkdownContent content={segment.content} />
          </div>
        </details>
      ) : (
        <MarkdownContent content={segment.content} key={`${segment.kind}-${index}`} />
      ))}
    </div>
  );
}

export default MarkdownMessage;
