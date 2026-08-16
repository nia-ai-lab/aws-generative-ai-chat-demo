import { z } from 'zod';
import { MODEL_KEYS } from './model-catalog.js';

const modelKeySchema = z.enum(MODEL_KEYS);
const uuidSchema = z.string().uuid();

export const chatRequestSchema = z.object({
  requestId: uuidSchema,
  browserSessionId: uuidSchema,
  conversationSessionId: uuidSchema,
  modelKey: modelKeySchema,
  message: z.string().trim().min(1).max(8_000),
  userSystemPrompt: z.string().max(4_000).default(''),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;

export const publicConfigSchema = z.object({
  configVersion: z.number().int().positive(),
  defaultModelKey: modelKeySchema,
  models: z.array(z.object({ key: modelKeySchema, label: z.string().min(1) })).min(1),
});

export type PublicConfig = z.infer<typeof publicConfigSchema>;

export const adminConfigSchema = z.object({
  configVersion: z.number().int().positive(),
  defaultModelKey: modelKeySchema,
  enabledModelKeys: z.array(modelKeySchema).min(1),
  defaultSystemPrompt: z.string().min(1).max(8_000),
  updatedAt: z.string(),
  updatedBy: z.string(),
});

export type AdminConfig = z.infer<typeof adminConfigSchema>;

export const updateAdminConfigSchema = z
  .object({
    expectedConfigVersion: z.number().int().positive(),
    defaultModelKey: modelKeySchema,
    enabledModelKeys: z.array(modelKeySchema).min(1),
    defaultSystemPrompt: z.string().trim().min(1).max(8_000),
  })
  .superRefine((value, context) => {
    if (!value.enabledModelKeys.includes(value.defaultModelKey)) {
      context.addIssue({
        code: 'custom',
        message: 'The default model must be enabled.',
        path: ['defaultModelKey'],
      });
    }
    if (new Set(value.enabledModelKeys).size !== value.enabledModelKeys.length) {
      context.addIssue({
        code: 'custom',
        message: 'Enabled models must be unique.',
        path: ['enabledModelKeys'],
      });
    }
  });

export type UpdateAdminConfig = z.infer<typeof updateAdminConfigSchema>;

export type ChatStreamEvent =
  | { type: 'meta'; requestId: string; modelKey: string }
  | { type: 'delta'; text: string }
  | { type: 'done'; finishReason: string; usage?: { inputTokens?: number; outputTokens?: number } }
  | { type: 'error'; code: string; message: string };
