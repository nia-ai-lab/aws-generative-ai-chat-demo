import { z } from 'zod';

export const DEFAULT_GENERATION_CONFIG = {
  temperature: 0.3,
  topP: null,
  maxOutputTokens: 1_024,
} as const;

export const generationConfigSchema = z.object({
  temperature: z.number().min(0).max(1),
  topP: z.number().min(0).max(1).nullable(),
  maxOutputTokens: z.number().int().min(1).max(4_096),
});

export type GenerationConfig = z.infer<typeof generationConfigSchema>;
