import { describe, expect, it } from 'vitest';
import type { ChatStreamEvent } from '../../shared/api-schema';
import { expiresSoon, streamWithTokenRetry } from '../../src/lib/token-refresh';

function sse(...events: object[]): Response {
  return new Response(events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(''), {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

async function collect(stream: AsyncGenerator<ChatStreamEvent>): Promise<ChatStreamEvent[]> {
  const events: ChatStreamEvent[] = [];
  for await (const event of stream) events.push(event);
  return events;
}

function sender(...responses: Response[]) {
  const calls: boolean[] = [];
  const send = (forceRefresh: boolean) => {
    calls.push(forceRefresh);
    const response = responses.shift();
    if (!response) throw new Error('unexpected request');
    return Promise.resolve(response);
  };
  return { calls, send };
}

const rejected = { type: 'error', code: 'UNAUTHORIZED', message: 'The access token was rejected.' };
const delta = { type: 'delta', text: 'こんにちは' };

describe('expiresSoon', () => {
  const now = Date.UTC(2026, 10, 15, 5, 52, 19);

  it('refreshes tokens inside the margin before expiry', () => {
    expect(expiresSoon(now / 1000 + 52, now)).toBe(true);
    expect(expiresSoon(now / 1000 - 1, now)).toBe(true);
  });

  it('keeps tokens with enough lifetime left', () => {
    expect(expiresSoon(now / 1000 + 600, now)).toBe(false);
    expect(expiresSoon(undefined, now)).toBe(false);
  });
});

describe('streamWithTokenRetry', () => {
  it('streams normally without refreshing', async () => {
    const { calls, send } = sender(sse(delta));

    expect(await collect(streamWithTokenRetry(send))).toEqual([delta]);
    expect(calls).toEqual([false]);
  });

  it('resends once with a fresh token when the runtime rejects the token', async () => {
    const { calls, send } = sender(sse(rejected), sse(delta));

    expect(await collect(streamWithTokenRetry(send))).toEqual([delta]);
    expect(calls).toEqual([false, true]);
  });

  it('resends once with a fresh token after an HTTP 401', async () => {
    const { calls, send } = sender(new Response('{}', { status: 401 }), sse(delta));

    expect(await collect(streamWithTokenRetry(send))).toEqual([delta]);
    expect(calls).toEqual([false, true]);
  });

  it('shows the rejection when the fresh token is rejected too', async () => {
    const { calls, send } = sender(sse(rejected), sse(rejected));

    expect(await collect(streamWithTokenRetry(send))).toEqual([rejected]);
    expect(calls).toEqual([false, true]);
  });

  it('does not retry other errors', async () => {
    const { calls, send } = sender(new Response(JSON.stringify({ code: 'RATE_LIMITED' }), { status: 429 }));

    await expect(collect(streamWithTokenRetry(send))).rejects.toThrow('RATE_LIMITED');
    expect(calls).toEqual([false]);
  });
});
