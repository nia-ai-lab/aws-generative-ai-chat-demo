import type { ContentSafetyAlerts } from '../../shared/api-schema';

export function hasContentSafetyAlert(alerts: ContentSafetyAlerts): boolean {
  return alerts.alarmState === 'ALARM' || alerts.participants.some((participant) => participant.overThreshold);
}

export function shortActorId(actorId: string): string {
  return actorId.length > 12 ? `${actorId.slice(0, 12)}…` : actorId;
}

export function formatAlertTime(value: string, timeZone = 'Asia/Tokyo'): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
