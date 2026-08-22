import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { adminConfigSchema, type AdminConfig } from '../../../shared/api-schema.js';
import {
  DEFAULT_GUARDRAIL_KEYS,
  guardrailKeySchema,
  guardrailPolicyKeysSchema,
} from '../../../shared/guardrail-catalog.js';
import { DEFAULT_MODEL_KEY, MODEL_KEYS } from '../../../shared/model-catalog.js';
import { DEFAULT_USD_TO_JPY_RATE } from '../../../shared/model-pricing.js';
import { DEFAULT_ENABLED_TOOL_KEYS, toolKeysSchema } from '../../../shared/tool-catalog.js';

export const CONFIG_KEY = 'APP_CONFIG';
export const DEFAULT_SYSTEM_PROMPT = '';

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});

export function defaultConfig(): AdminConfig {
  return {
    configVersion: 1,
    defaultModelKey: DEFAULT_MODEL_KEY,
    enabledModelKeys: [...MODEL_KEYS],
    defaultSystemPrompt: DEFAULT_SYSTEM_PROMPT,
    requiredGuardrailKeys: [...DEFAULT_GUARDRAIL_KEYS],
    enabledToolKeys: [...DEFAULT_ENABLED_TOOL_KEYS],
    usdToJpyRate: DEFAULT_USD_TO_JPY_RATE,
    updatedAt: new Date(0).toISOString(),
    updatedBy: 'system',
  };
}

export async function readConfig(): Promise<AdminConfig> {
  const tableName = process.env.CONFIG_TABLE_NAME;
  if (!tableName) throw new Error('CONFIG_TABLE_NAME is not configured.');
  const response = await client.send(new GetCommand({ TableName: tableName, Key: { pk: CONFIG_KEY } }));
  if (!response.Item) return defaultConfig();
  const requiredGuardrails = guardrailPolicyKeysSchema.safeParse(response.Item.requiredGuardrailKeys);
  const legacyRequiredGuardrail = guardrailKeySchema.safeParse(response.Item.requiredGuardrailKey);
  const enabledTools = toolKeysSchema.safeParse(response.Item.enabledToolKeys);
  const migratedLegacyGuardrails = legacyRequiredGuardrail.success && legacyRequiredGuardrail.data !== 'none'
    ? [legacyRequiredGuardrail.data]
    : DEFAULT_GUARDRAIL_KEYS;
  return adminConfigSchema.parse({
    ...response.Item,
    requiredGuardrailKeys: requiredGuardrails.success ? requiredGuardrails.data : migratedLegacyGuardrails,
    enabledToolKeys: enabledTools.success ? enabledTools.data : DEFAULT_ENABLED_TOOL_KEYS,
    usdToJpyRate: response.Item.usdToJpyRate ?? DEFAULT_USD_TO_JPY_RATE,
  });
}

export { client as documentClient };
