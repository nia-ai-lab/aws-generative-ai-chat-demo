import { z } from 'zod';
import { generationConfigSchema } from './generation-config.js';
import { guardrailPolicyKeysSchema } from './guardrail-catalog.js';
import { MODEL_KEYS } from './model-catalog.js';
import {
  MAX_USD_TO_JPY_RATE,
  MIN_USD_TO_JPY_RATE,
  type ModelUsage,
} from './model-pricing.js';
import { toolKeysSchema } from './tool-catalog.js';

const modelKeySchema = z.enum(MODEL_KEYS);
const uuidSchema = z.string().uuid();
const timeZoneSchema = z.string().min(1).max(64).refine((value) => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}, 'A valid IANA time zone is required.');

export const chatRequestSchema = z.object({
  requestId: uuidSchema,
  browserSessionId: uuidSchema,
  conversationSessionId: uuidSchema,
  modelKey: modelKeySchema,
  message: z.string().trim().min(1).max(8_000),
  userSystemPrompt: z.string().max(4_000).default(''),
  guardrailKeys: guardrailPolicyKeysSchema.default([]),
  toolKeys: toolKeysSchema.default([]),
  timeZone: timeZoneSchema,
  generationConfig: generationConfigSchema,
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;

export const publicConfigSchema = z.object({
  configVersion: z.number().int().positive(),
  defaultModelKey: modelKeySchema,
  models: z.array(z.object({ key: modelKeySchema, label: z.string().min(1) })).min(1),
  requiredGuardrailKeys: guardrailPolicyKeysSchema,
  availableToolKeys: toolKeysSchema,
});

export type PublicConfig = z.infer<typeof publicConfigSchema>;

export const adminConfigSchema = z.object({
  configVersion: z.number().int().positive(),
  defaultModelKey: modelKeySchema,
  enabledModelKeys: z.array(modelKeySchema).min(1),
  defaultSystemPrompt: z.string().max(8_000),
  requiredGuardrailKeys: guardrailPolicyKeysSchema,
  enabledToolKeys: toolKeysSchema,
  usdToJpyRate: z.number().min(MIN_USD_TO_JPY_RATE).max(MAX_USD_TO_JPY_RATE),
  updatedAt: z.string(),
  updatedBy: z.string(),
});

export type AdminConfig = z.infer<typeof adminConfigSchema>;

export const updateAdminConfigSchema = z
  .object({
    expectedConfigVersion: z.number().int().positive(),
    defaultModelKey: modelKeySchema,
    enabledModelKeys: z.array(modelKeySchema).min(1),
    defaultSystemPrompt: z.string().trim().max(8_000),
    requiredGuardrailKeys: guardrailPolicyKeysSchema,
    enabledToolKeys: toolKeysSchema,
    usdToJpyRate: z.number().min(MIN_USD_TO_JPY_RATE).max(MAX_USD_TO_JPY_RATE),
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

export interface TrustedSource {
  type: 'web' | 'rag';
  title: string;
  uri?: string;
  excerpt?: string;
}

export interface ToolUsage {
  webSearchQueries: number;
  ragRetrievals: number;
  webSearchCostJpy?: number;
}

export const guardrailTraceResultSchema = z.enum(['BLOCKED', 'ANONYMIZED', 'DETECTED']);
export const guardrailTraceSourceSchema = z.enum(['input', 'output']);
export const guardrailTracePolicySchema = z.enum([
  'content',
  'topic',
  'word',
  'sensitive-information',
  'contextual-grounding',
  'automated-reasoning',
]);
export const guardrailAssessmentSummarySchema = z.object({
  source: guardrailTraceSourceSchema,
  policy: guardrailTracePolicySchema,
  name: z.string().min(1).max(128),
  action: z.string().min(1).max(32),
  confidence: z.string().min(1).max(32).optional(),
  filterStrength: z.string().min(1).max(32).optional(),
  detected: z.boolean().optional(),
  score: z.number().finite().optional(),
  threshold: z.number().finite().optional(),
}).strict();
export const guardrailTraceSummarySchema = z.object({
  result: guardrailTraceResultSchema,
  guardrails: z.array(z.object({
    id: z.string().min(1).max(64),
    version: z.string().min(1).max(16),
  }).strict()).max(16),
  assessments: z.array(guardrailAssessmentSummarySchema).max(100),
}).strict();

export type GuardrailTraceResult = z.infer<typeof guardrailTraceResultSchema>;
export type GuardrailTraceSource = z.infer<typeof guardrailTraceSourceSchema>;
export type GuardrailTracePolicy = z.infer<typeof guardrailTracePolicySchema>;
export type GuardrailAssessmentSummary = z.infer<typeof guardrailAssessmentSummarySchema>;
export type GuardrailTraceSummary = z.infer<typeof guardrailTraceSummarySchema>;

export type ChatStreamEvent =
  | { type: 'meta'; requestId: string; modelKey: string }
  | { type: 'delta'; text: string }
  | {
    type: 'done';
    finishReason: string;
    usage?: ModelUsage;
    sources?: TrustedSource[];
    toolUsage?: ToolUsage;
    guardrailTrace?: GuardrailTraceSummary;
  }
  | { type: 'error'; code: string; message: string };
