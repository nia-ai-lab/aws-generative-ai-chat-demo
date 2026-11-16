import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { ContentSafetyAlerts } from '../../shared/api-schema';
import { ContentSafetyAlertsPanel } from '../../src/components/ContentSafetyAlertsPanel';
import { hasContentSafetyAlert } from '../../src/lib/content-safety-alerts';

const base: ContentSafetyAlerts = {
  alarmState: 'OK',
  threshold: 5,
  windowMinutes: 10,
  lookbackMinutes: 60,
  checkedAt: '2026-11-16T01:47:00.000Z',
  participants: [],
};

describe('ContentSafetyAlertsPanel', () => {
  it('shows a calm state when nobody was blocked', () => {
    const html = renderToStaticMarkup(<ContentSafetyAlertsPanel alerts={base} />);
    expect(html).toContain('正常');
    expect(html).toContain('ブロックされた受講者はいません。');
    expect(hasContentSafetyAlert(base)).toBe(false);
  });

  it('highlights participants over the threshold', () => {
    const alerts: ContentSafetyAlerts = {
      ...base,
      alarmState: 'ALARM',
      participants: [{
        actorId: '1ed70fd535bde4fa1909feb5f0829aac',
        windowStart: '2026-11-16T01:40:00.000Z',
        blockCount: 6,
        lastBlockedAt: '2026-11-16T01:46:00.000Z',
        overThreshold: true,
      }],
    };
    const html = renderToStaticMarkup(<ContentSafetyAlertsPanel alerts={alerts} />);
    expect(html).toContain('アラーム');
    expect(html).toContain('over-threshold');
    expect(html).toContain('10:40〜');
    expect(html).toContain('>6<');
    expect(hasContentSafetyAlert(alerts)).toBe(true);
  });
});
