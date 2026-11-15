import type { ChatStreamEvent } from '../../shared/api-schema';
import { readSse } from './sse';

// AgentCore Runtime rejects access tokens during roughly their last minute, while Amplify keeps
// reusing a token until a few seconds before it expires. Refresh well before that window.
export const TOKEN_REFRESH_MARGIN_SECONDS = 120;

export function expiresSoon(
  expiresAtSeconds: unknown,
  nowMs = Date.now(),
  marginSeconds = TOKEN_REFRESH_MARGIN_SECONDS,
): boolean {
  return typeof expiresAtSeconds === 'number' && expiresAtSeconds * 1000 - nowMs < marginSeconds * 1000;
}

// The chat API reports a token rejected by the agent runtime as the first stream event.
// Nothing has run at that point, so the request can be resent once with a fresh token.
export function isTokenRejectedEvent(event: ChatStreamEvent): boolean {
  return event.type === 'error' && event.code === 'UNAUTHORIZED';
}

async function errorCode(response: Response): Promise<string> {
  const body = (await response.json().catch(() => ({}))) as { code?: string };
  return body.code ?? `HTTP_${response.status}`;
}

export async function* streamWithTokenRetry(
  send: (forceRefresh: boolean) => Promise<Response>,
): AsyncGenerator<ChatStreamEvent> {
  const first = await send(false);
  if (first.status === 401) {
    await first.body?.cancel();
    yield* streamOnce(await send(true));
    return;
  }
  if (!first.ok) throw new Error(await errorCode(first));

  const events = readSse(first);
  const head = await events.next();
  if (head.done) return;
  if (isTokenRejectedEvent(head.value)) {
    await events.return(undefined);
    yield* streamOnce(await send(true));
    return;
  }
  yield head.value;
  yield* events;
}

async function* streamOnce(response: Response): AsyncGenerator<ChatStreamEvent> {
  if (!response.ok) throw new Error(await errorCode(response));
  yield* readSse(response);
}
