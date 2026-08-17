import type { APIGatewayProxyHandler } from 'aws-lambda';
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { updateAdminConfigSchema } from '../../../shared/api-schema.js';
import { PUBLIC_MODELS } from '../../../shared/model-catalog.js';
import { getAuthContext, requireAdmin } from '../shared/auth.js';
import { CONFIG_KEY, documentClient, readConfig } from '../shared/config.js';
import { errorResponse, jsonResponse } from '../shared/http.js';

export const handler: APIGatewayProxyHandler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return jsonResponse(event, 204, {});

  try {
    const auth = getAuthContext(event);
    const isAdminPath = event.path.endsWith('/admin/config');

    if (!isAdminPath && event.httpMethod === 'GET') {
      const config = await readConfig();
      return jsonResponse(event, 200, {
        configVersion: config.configVersion,
        defaultModelKey: config.defaultModelKey,
        models: PUBLIC_MODELS.filter((model) => config.enabledModelKeys.includes(model.key)),
        requiredGuardrailKeys: config.requiredGuardrailKeys,
      });
    }

    requireAdmin(auth);
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
      defaultModelKey: input.defaultModelKey,
      enabledModelKeys: input.enabledModelKeys,
      defaultSystemPrompt: input.defaultSystemPrompt,
      requiredGuardrailKeys: input.requiredGuardrailKeys,
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
      defaultModelKey: updated.defaultModelKey,
      enabledModelKeys: updated.enabledModelKeys,
      requiredGuardrailKeys: updated.requiredGuardrailKeys,
      usdToJpyRate: updated.usdToJpyRate,
    }));
    return jsonResponse(event, 200, {
      configVersion: updated.configVersion,
      defaultModelKey: updated.defaultModelKey,
      enabledModelKeys: updated.enabledModelKeys,
      defaultSystemPrompt: updated.defaultSystemPrompt,
      requiredGuardrailKeys: updated.requiredGuardrailKeys,
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
