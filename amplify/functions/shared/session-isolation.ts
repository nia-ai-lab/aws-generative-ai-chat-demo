import { createHash } from 'node:crypto';

export function actorId(sub: string, browserSessionId: string): string {
  return createHash('sha256').update(`${sub}:${browserSessionId}`, 'utf8').digest('hex');
}

export function runtimeSessionId(actor: string, conversationSessionId: string): string {
  return createHash('sha256').update(`${actor}:${conversationSessionId}`, 'utf8').digest('hex');
}
