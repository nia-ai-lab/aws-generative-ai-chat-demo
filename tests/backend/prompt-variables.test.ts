import { describe, expect, it } from 'vitest';
import { expandPromptVariables } from '../../shared/prompt-variables.js';

describe('prompt variable expansion', () => {
  const now = new Date('2026-08-16T06:07:08.456Z');

  it('injects the local date and IANA time zone at request time', () => {
    expect(expandPromptVariables('現在=$DATETIME\n地域=$TIMEZONE', {
      now,
      timeZone: 'Asia/Tokyo',
    })).toBe('現在=2026-08-16T15:07:08+09:00\n地域=Asia/Tokyo');
  });

  it('replaces repeated variables and honors daylight saving time', () => {
    expect(expandPromptVariables('$TIMEZONE $DATETIME / $DATETIME', {
      now,
      timeZone: 'America/New_York',
    })).toBe('America/New_York 2026-08-16T02:07:08-04:00 / 2026-08-16T02:07:08-04:00');
  });

  it('keeps an empty prompt empty', () => {
    expect(expandPromptVariables('', { now, timeZone: 'UTC' })).toBe('');
  });
});
