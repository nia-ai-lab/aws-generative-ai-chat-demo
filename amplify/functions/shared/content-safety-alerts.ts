import { QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import {
  CONTENT_SAFETY_ALERT_RULE,
  type ContentSafetyAlerts,
  type ContentSafetyAlarmState,
  type GuardrailTraceSummary,
} from '../../../shared/api-schema.js';
import { CONTENT_SAFETY_FILTER_TYPES } from '../../../shared/guardrail-catalog.js';
import { documentClient } from './config.js';

const WINDOW_MS = CONTENT_SAFETY_ALERT_RULE.windowMinutes * 60_000;
const RETENTION_SECONDS = 2 * 60 * 60;
const contentSafetyFilterTypes = new Set<string>(CONTENT_SAFETY_FILTER_TYPES);

export function isContentSafetyBlocked(trace: GuardrailTraceSummary | undefined): boolean {
  return trace?.assessments.some((assessment) => assessment.policy === 'content'
    && assessment.action === 'BLOCKED'
    && contentSafetyFilterTypes.has(assessment.name)) ?? false;
}

export function windowStart(now: Date): string {
  return new Date(Math.floor(now.getTime() / WINDOW_MS) * WINDOW_MS).toISOString();
}

export function recentWindowStarts(now: Date): string[] {
  const count = Math.ceil(CONTENT_SAFETY_ALERT_RULE.lookbackMinutes / CONTENT_SAFETY_ALERT_RULE.windowMinutes);
  const current = new Date(windowStart(now)).getTime();
  return Array.from({ length: count }, (_, index) => new Date(current - index * WINDOW_MS).toISOString());
}

function tableName(): string {
  const name = process.env.CONTENT_SAFETY_TABLE_NAME;
  if (!name) throw new Error('Content safety alert table is not configured.');
  return name;
}

/** Count a content-safety block for a participant and return the count in the current window. */
export async function recordContentSafetyBlock(actorId: string, now = new Date()): Promise<number> {
  const result = await documentClient.send(new UpdateCommand({
    TableName: tableName(),
    Key: { windowStart: windowStart(now), actorId },
    UpdateExpression: 'ADD blockCount :one SET lastBlockedAt = :now, expiresAt = :expiresAt',
    ExpressionAttributeValues: {
      ':one': 1,
      ':now': now.toISOString(),
      ':expiresAt': Math.floor(now.getTime() / 1000) + RETENTION_SECONDS,
    },
    ReturnValues: 'UPDATED_NEW',
  }));
  const count = result.Attributes?.blockCount;
  return typeof count === 'number' ? count : 1;
}

type ParticipantBlocks = ContentSafetyAlerts['participants'][number];

export function summarizeParticipants(items: Record<string, unknown>[]): ParticipantBlocks[] {
  return items
    .filter((item) => typeof item.actorId === 'string' && typeof item.windowStart === 'string')
    .map((item) => {
      const blockCount = typeof item.blockCount === 'number' ? item.blockCount : 0;
      return {
        actorId: String(item.actorId),
        windowStart: String(item.windowStart),
        blockCount,
        lastBlockedAt: typeof item.lastBlockedAt === 'string' ? item.lastBlockedAt : String(item.windowStart),
        overThreshold: blockCount >= CONTENT_SAFETY_ALERT_RULE.threshold,
      };
    })
    .sort((a, b) => b.blockCount - a.blockCount || b.lastBlockedAt.localeCompare(a.lastBlockedAt))
    .slice(0, 100);
}

export async function listRecentContentSafetyBlocks(now = new Date()): Promise<ParticipantBlocks[]> {
  const pages = await Promise.all(recentWindowStarts(now).map((start) => documentClient.send(new QueryCommand({
    TableName: tableName(),
    KeyConditionExpression: 'windowStart = :start',
    ExpressionAttributeValues: { ':start': start },
  }))));
  return summarizeParticipants(pages.flatMap((page) => page.Items ?? []));
}

export function toAlarmState(value: string | undefined): ContentSafetyAlarmState {
  return value === 'OK' || value === 'ALARM' || value === 'INSUFFICIENT_DATA' ? value : 'UNKNOWN';
}
