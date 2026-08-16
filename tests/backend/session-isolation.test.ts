import { describe, expect, it } from 'vitest';
import { actorId, runtimeSessionId } from '../../amplify/functions/shared/session-isolation.js';

describe('AgentCore session isolation', () => {
  it('separates the same Cognito user by browser session', () => {
    const first = actorId('shared-user-sub', '55f4ec01-f06b-4d97-8cf7-19999ddabda0');
    const second = actorId('shared-user-sub', 'b52817f8-3778-45be-8ca6-5ad67956b9f7');

    expect(first).not.toBe(second);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
  });

  it('separates Runtime microVMs by actor and conversation', () => {
    const conversation = 'd9428888-122b-4b23-aeb7-3240e8a7f8a1';
    const firstActor = actorId('shared-user-sub', '55f4ec01-f06b-4d97-8cf7-19999ddabda0');
    const secondActor = actorId('shared-user-sub', 'b52817f8-3778-45be-8ca6-5ad67956b9f7');

    expect(runtimeSessionId(firstActor, conversation)).not.toBe(runtimeSessionId(secondActor, conversation));
    expect(runtimeSessionId(firstActor, conversation)).toMatch(/^[a-f0-9]{64}$/);
  });
});
