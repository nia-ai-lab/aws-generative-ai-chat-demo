import type { APIGatewayProxyHandler } from 'aws-lambda';
import { CloudWatchClient, DescribeAlarmsCommand } from '@aws-sdk/client-cloudwatch';
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import {
  CONTENT_SAFETY_ALERT_RULE,
  updateAdminConfigSchema,
  type ContentSafetyAlerts,
} from '../../../shared/api-schema.js';
import { PUBLIC_MODELS } from '../../../shared/model-catalog.js';
import { getAuthContext, requireAdmin } from '../shared/auth.js';
import { CONFIG_KEY, documentClient, readConfig } from '../shared/config.js';
import { listRecentContentSafetyBlocks, toAlarmState } from '../shared/content-safety-alerts.js';
import { errorResponse, jsonResponse } from '../shared/http.js';

const cloudWatch = new CloudWatchClient({});

async function contentSafetyAlarm(): Promise<Pick<ContentSafetyAlerts, 'alarmState' | 'alarmUpdatedAt'>> {
  const alarmName = process.env.CONTENT_SAFETY_ALARM_NAME;
  if (!alarmName) return { alarmState: 'UNKNOWN' };
  try {
    const result = await cloudWatch.send(new DescribeAlarmsCommand({ AlarmNames: [alarmName] }));
    const alarm = result.MetricAlarms?.[0];
    return {
      alarmState: toAlarmState(alarm?.StateValue),
      alarmUpdatedAt: alarm?.StateUpdatedTimestamp?.toISOString(),
    };
  } catch (error) {
    console.error(JSON.stringify({
      eventType: 'CONTENT_SAFETY_ALARM_UNAVAILABLE',
      errorType: error instanceof Error ? error.name : 'UnknownError',
    }));
    return { alarmState: 'UNKNOWN' };
  }
}

async function contentSafetyAlerts(): Promise<ContentSafetyAlerts> {
  const now = new Date();
  const [alarm, participants] = await Promise.all([contentSafetyAlarm(), listRecentContentSafetyBlocks(now)]);
  return { ...alarm, ...CONTENT_SAFETY_ALERT_RULE, checkedAt: now.toISOString(), participants };
}

export const handler: APIGatewayProxyHandler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return jsonResponse(event, 204, {});

  try {
    const auth = getAuthContext(event);
    const isAdminPath = event.path.includes('/admin/');

    if (!isAdminPath && event.httpMethod === 'GET') {
      const config = await readConfig();
      return jsonResponse(event, 200, {
        configVersion: config.configVersion,
        participantAccessEnabled: config.participantAccessEnabled,
        defaultModelKey: config.defaultModelKey,
        models: PUBLIC_MODELS.filter((model) => config.enabledModelKeys.includes(model.key)),
        requiredGuardrailKeys: config.requiredGuardrailKeys,
        availableToolKeys: config.enabledToolKeys,
      });
    }

    requireAdmin(auth);
    if (event.path.endsWith('/admin/alerts')) {
      if (event.httpMethod !== 'GET') return errorResponse(event, 405, 'METHOD_NOT_ALLOWED');
      return jsonResponse(event, 200, await contentSafetyAlerts());
    }
    if (event.httpMethod === 'GET') return jsonResponse(event, 200, await readConfig());
    if (event.httpMethod !== 'PUT') return errorResponse(event, 405, 'METHOD_NOT_ALLOWED');

    const input = updateAdminConfigSchema.parse(JSON.parse(event.body ?? '{}'));
    const current = await readConfig();
    if (current.configVersion !== input.expectedConfigVersion) {
      return errorResponse(event, 409, 'CONFIG_VERSION_CONFLICT');
    }

    const updated = {
      pk: CONFIG_KEY,
      configVersion: input.expectedConfigVersion + 1,
      participantAccessEnabled: input.participantAccessEnabled,
      defaultModelKey: input.defaultModelKey,
      enabledModelKeys: input.enabledModelKeys,
      defaultSystemPrompt: input.defaultSystemPrompt,
      requiredGuardrailKeys: input.requiredGuardrailKeys,
      enabledToolKeys: input.enabledToolKeys,
      usdToJpyRate: input.usdToJpyRate,
      updatedAt: new Date().toISOString(),
      updatedBy: auth.sub,
    };
    const isInitialWrite = input.expectedConfigVersion === 1 && current.updatedBy === 'system';
    await documentClient.send(new PutCommand({
      TableName: process.env.CONFIG_TABLE_NAME,
      Item: updated,
      ConditionExpression: isInitialWrite ? 'attribute_not_exists(pk)' : 'configVersion = :expected',
      ExpressionAttributeValues: isInitialWrite ? undefined : { ':expected': input.expectedConfigVersion },
    }));

    console.info(JSON.stringify({
      eventType: 'ADMIN_CONFIG_UPDATED',
      timestamp: updated.updatedAt,
      updatedBy: auth.sub,
      configVersion: updated.configVersion,
      participantAccessEnabled: updated.participantAccessEnabled,
      defaultModelKey: updated.defaultModelKey,
      enabledModelKeys: updated.enabledModelKeys,
      requiredGuardrailKeys: updated.requiredGuardrailKeys,
      enabledToolKeys: updated.enabledToolKeys,
      usdToJpyRate: updated.usdToJpyRate,
    }));
    return jsonResponse(event, 200, {
      configVersion: updated.configVersion,
      participantAccessEnabled: updated.participantAccessEnabled,
      defaultModelKey: updated.defaultModelKey,
      enabledModelKeys: updated.enabledModelKeys,
      defaultSystemPrompt: updated.defaultSystemPrompt,
      requiredGuardrailKeys: updated.requiredGuardrailKeys,
      enabledToolKeys: updated.enabledToolKeys,
      usdToJpyRate: updated.usdToJpyRate,
      updatedAt: updated.updatedAt,
      updatedBy: updated.updatedBy,
    });
  } catch (error) {
    if (error instanceof ConditionalCheckFailedException) return errorResponse(event, 409, 'CONFIG_VERSION_CONFLICT');
    if (error instanceof SyntaxError || (typeof error === 'object' && error !== null && 'issues' in error)) {
      return errorResponse(event, 400, 'VALIDATION_ERROR');
    }
    if (error instanceof Error && error.message === 'FORBIDDEN') return errorResponse(event, 403, 'FORBIDDEN');
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return errorResponse(event, 401, 'UNAUTHORIZED');
    console.error(JSON.stringify({ eventType: 'CONFIG_ERROR', errorType: error instanceof Error ? error.name : 'UnknownError' }));
    return errorResponse(event, 500, 'INTERNAL_ERROR');
  }
};
