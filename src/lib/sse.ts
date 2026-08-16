import type { ChatStreamEvent } from '../../shared/api-schema';

export function parseSseBlock(block: string): ChatStreamEvent | undefined {
  const data = block
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart())
    .join('\n');

  if (!data) return undefined;
  return JSON.parse(data) as ChatStreamEvent;
}

export async function* readSse(response: Response): AsyncGenerator<ChatStreamEvent> {
  if (!response.body) throw new Error('Streaming response is not available.');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const blocks = buffer.split(/\r?\n\r?\n/);
    buffer = blocks.pop() ?? '';

    for (const block of blocks) {
      const event = parseSseBlock(block);
      if (event) yield event;
    }

    if (done) break;
  }

  if (buffer.trim()) {
    const event = parseSseBlock(buffer);
    if (event) yield event;
  }
}
