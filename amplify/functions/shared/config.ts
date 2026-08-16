import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { adminConfigSchema, type AdminConfig } from '../../../shared/api-schema.js';
import { DEFAULT_GUARDRAIL_KEY, guardrailKeySchema } from '../../../shared/guardrail-catalog.js';
import { DEFAULT_MODEL_KEY, MODEL_KEYS } from '../../../shared/model-catalog.js';

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
    requiredGuardrailKey: DEFAULT_GUARDRAIL_KEY,
    updatedAt: new Date(0).toISOString(),
    updatedBy: 'system',
  };
}

export async function readConfig(): Promise<AdminConfig> {
  const tableName = process.env.CONFIG_TABLE_NAME;
  if (!tableName) throw new Error('CONFIG_TABLE_NAME is not configured.');
  const response = await client.send(new GetCommand({ TableName: tableName, Key: { pk: CONFIG_KEY } }));
  if (!response.Item) return defaultConfig();
  const requiredGuardrail = guardrailKeySchema.safeParse(response.Item.requiredGuardrailKey);
  return adminConfigSchema.parse({
    ...response.Item,
    requiredGuardrailKey: requiredGuardrail.success ? requiredGuardrail.data : DEFAULT_GUARDRAIL_KEY,
  });
}

export { client as documentClient };
