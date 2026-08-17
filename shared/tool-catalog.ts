import { z } from 'zod';

export const TOOL_KEYS = ['web-search', 'rag'] as const;
export type ToolKey = (typeof TOOL_KEYS)[number];

export const toolKeySchema = z.enum(TOOL_KEYS);
export const toolKeysSchema = z.array(toolKeySchema).max(TOOL_KEYS.length).refine(
  (keys) => new Set(keys).size === keys.length,
  'Tools must be unique.',
);

export const TOOL_CATALOG: Record<ToolKey, {
  label: string;
  description: string;
}> = {
  'web-search': {
    label: 'Web検索',
    description: '必要に応じてAIが最新の公開情報を検索します。',
  },
  rag: {
    label: 'RAG（社内規定検索）',
    description: '架空企業の社内規定を毎回検索し、回答の根拠にします。',
  },
};

export const DEFAULT_ENABLED_TOOL_KEYS: ToolKey[] = [...TOOL_KEYS];
export const DEFAULT_PARTICIPANT_TOOL_KEYS: ToolKey[] = [];
