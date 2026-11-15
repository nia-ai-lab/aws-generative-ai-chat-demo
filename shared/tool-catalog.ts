import { z } from 'zod';

export const TOOL_KEYS = ['web-search', 'rag', 'product-rag', 'hr-tools'] as const;
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
    description: '架空企業 AnyCompany の人事規程を毎回検索し、回答の根拠にします。',
  },
  'product-rag': {
    label: 'RAG（製品情報検索）',
    description: '架空の家電製品資料を毎回検索し、顧客サポート回答の根拠にします。',
  },
  'hr-tools': {
    label: '人事ツール（AnyCompany 人事システム）',
    description: 'AIが必要に応じて人事規程の検索、休暇の残日数照会、休暇申請の下書き・提出、給与明細の照会を実行します。申請の提出には本人の承認が必要です（架空の人事システム）。',
  },
};

export const DEFAULT_ENABLED_TOOL_KEYS: ToolKey[] = [...TOOL_KEYS];
export const DEFAULT_PARTICIPANT_TOOL_KEYS: ToolKey[] = [];
