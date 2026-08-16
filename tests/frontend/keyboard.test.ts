import { describe, expect, it } from 'vitest';
import { shouldSendOnKeyDown } from '../../src/lib/keyboard';

describe('shouldSendOnKeyDown', () => {
  it('sends on a plain Enter key', () => {
    expect(shouldSendOnKeyDown({ key: 'Enter', shiftKey: false, isComposing: false, keyCode: 13 })).toBe(true);
  });

  it('does not send while Japanese IME is composing', () => {
    expect(shouldSendOnKeyDown({ key: 'Enter', shiftKey: false, isComposing: true, keyCode: 229 })).toBe(false);
    expect(shouldSendOnKeyDown({ key: 'Enter', shiftKey: false, isComposing: false, keyCode: 229 })).toBe(false);
  });

  it('keeps Shift+Enter for a newline', () => {
    expect(shouldSendOnKeyDown({ key: 'Enter', shiftKey: true, isComposing: false, keyCode: 13 })).toBe(false);
  });
});
