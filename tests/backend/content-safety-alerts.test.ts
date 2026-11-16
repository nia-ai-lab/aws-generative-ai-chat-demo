import { describe, expect, it } from 'vitest';
import type { GuardrailTraceSummary } from '../../shared/api-schema.js';
import { lockedGuardrailKeysFor, withLockedGuardrailKeys } from '../../shared/guardrail-catalog.js';
import {
  isContentSafetyBlocked,
  recentWindowStarts,
  summarizeParticipants,
  toAlarmState,
  windowStart,
} from '../../amplify/functions/shared/content-safety-alerts.js';

function trace(policy: 'content' | 'topic', name: string, action = 'BLOCKED'): GuardrailTraceSummary {
  return {
    result: action === 'BLOCKED' ? 'BLOCKED' : 'DETECTED',
    guardrails: [{ id: 'g', version: '1' }],
    assessments: [{ source: 'input', policy, name, action, detected: true }],
  };
}

describe('participant guardrail lock', () => {
  it('always applies content safety to participants', () => {
    expect(withLockedGuardrailKeys(false, [])).toEqual(['content-safety']);
    expect(withLockedGuardrailKeys(false, ['denied-topic-travel'])).toEqual(['content-safety', 'denied-topic-travel']);
    expect(lockedGuardrailKeysFor(false)).toEqual(['content-safety']);
  });

  it('lets admins turn content safety off for demos', () => {
    expect(withLockedGuardrailKeys(true, [])).toEqual([]);
    expect(withLockedGuardrailKeys(true, ['prompt-attack'])).toEqual(['prompt-attack']);
    expect(lockedGuardrailKeysFor(true)).toEqual([]);
  });
});

describe('content safety block detection', () => {
  it('counts blocks by the five content-safety categories only', () => {
    expect(isContentSafetyBlocked(trace('content', 'SEXUAL'))).toBe(true);
    expect(isContentSafetyBlocked(trace('content', 'MISCONDUCT'))).toBe(true);
    expect(isContentSafetyBlocked(trace('content', 'PROMPT_ATTACK'))).toBe(false);
    expect(isContentSafetyBlocked(trace('topic', 'Travel'))).toBe(false);
    expect(isContentSafetyBlocked(trace('content', 'HATE', 'NONE'))).toBe(false);
    expect(isContentSafetyBlocked(undefined)).toBe(false);
  });
});

describe('alert windows', () => {
  it('uses fixed ten-minute windows over the last hour', () => {
    const now = new Date('2026-11-16T01:47:30.000Z');
    expect(windowStart(now)).toBe('2026-11-16T01:40:00.000Z');
    const starts = recentWindowStarts(now);
    expect(starts).toHaveLength(6);
    expect(starts[0]).toBe('2026-11-16T01:40:00.000Z');
    expect(starts[5]).toBe('2026-11-16T00:50:00.000Z');
  });

  it('lists participants with the most blocks first and flags the threshold', () => {
    const participants = summarizeParticipants([
      { windowStart: '2026-11-16T01:40:00.000Z', actorId: 'a', blockCount: 2, lastBlockedAt: '2026-11-16T01:41:00.000Z' },
      { windowStart: '2026-11-16T01:30:00.000Z', actorId: 'b', blockCount: 5, lastBlockedAt: '2026-11-16T01:35:00.000Z' },
      { windowStart: '2026-11-16T01:40:00.000Z' },
    ]);
    expect(participants.map((item) => [item.actorId, item.blockCount, item.overThreshold])).toEqual([
      ['b', 5, true],
      ['a', 2, false],
    ]);
  });

  it('maps unexpected alarm states to UNKNOWN', () => {
    expect(toAlarmState('ALARM')).toBe('ALARM');
    expect(toAlarmState(undefined)).toBe('UNKNOWN');
  });
});
