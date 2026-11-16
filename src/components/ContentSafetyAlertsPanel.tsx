import type { ContentSafetyAlerts } from '../../shared/api-schema';
import { formatAlertTime, hasContentSafetyAlert, shortActorId } from '../lib/content-safety-alerts';

const alarmStateLabels: Record<ContentSafetyAlerts['alarmState'], string> = {
  OK: '正常',
  ALARM: 'アラーム',
  INSUFFICIENT_DATA: 'データなし（正常）',
  UNKNOWN: '取得できません',
};

export function ContentSafetyAlertsPanel({ alerts }: { alerts?: ContentSafetyAlerts }) {
  if (!alerts) {
    return (
      <section className="content-safety-alerts" aria-label="コンテンツ保護のアラート">
        <h3>コンテンツ保護のアラート</h3>
        <p className="muted">読み込み中...</p>
      </section>
    );
  }

  const alerting = hasContentSafetyAlert(alerts);
  return (
    <section className={`content-safety-alerts ${alerting ? 'alerting' : ''}`} aria-label="コンテンツ保護のアラート">
      <h3>コンテンツ保護のアラート</h3>
      <p className="content-safety-alert-state">
        <span className={`alarm-state alarm-state-${alerts.alarmState.toLowerCase()}`}>
          {alarmStateLabels[alerts.alarmState]}
        </span>
        <small>
          受講者1人が{alerts.windowMinutes}分で{alerts.threshold}回以上ブロックされるとアラームになります。
          直近{alerts.lookbackMinutes}分の記録を表示しています（{formatAlertTime(alerts.checkedAt)} 時点）。
        </small>
      </p>
      {alerts.participants.length === 0 ? (
        <p className="muted">ブロックされた受講者はいません。</p>
      ) : (
        <table className="content-safety-alert-table">
          <thead>
            <tr>
              <th scope="col">受講者（actorId）</th>
              <th scope="col">時間帯</th>
              <th scope="col">回数</th>
              <th scope="col">最終</th>
            </tr>
          </thead>
          <tbody>
            {alerts.participants.map((participant) => (
              <tr
                key={`${participant.windowStart}-${participant.actorId}`}
                className={participant.overThreshold ? 'over-threshold' : undefined}
              >
                <td title={participant.actorId}><code>{shortActorId(participant.actorId)}</code></td>
                <td>{formatAlertTime(participant.windowStart)}〜</td>
                <td>{participant.blockCount}</td>
                <td>{formatAlertTime(participant.lastBlockedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
