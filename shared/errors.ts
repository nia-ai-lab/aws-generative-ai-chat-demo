export const ERROR_MESSAGES: Record<string, string> = {
  UNAUTHORIZED: 'ログインし直してください。',
  FORBIDDEN: 'この操作を行う権限がありません。',
  VALIDATION_ERROR: '入力内容を確認してください。',
  MODEL_NOT_ALLOWED: '選択したモデルは現在利用できません。',
  CONFIG_VERSION_CONFLICT: '設定が更新されています。再読み込みしてください。',
  RATE_LIMITED: '混み合っています。少し待ってから再試行してください。',
  MODEL_TIMEOUT: '応答に時間がかかっています。もう一度お試しください。',
  AGENT_UNAVAILABLE: 'AIに接続できません。もう一度お試しください。',
  INTERNAL_ERROR: 'エラーが発生しました。もう一度お試しください。',
};

export function safeErrorMessage(code: string): string {
  return ERROR_MESSAGES[code] ?? ERROR_MESSAGES.INTERNAL_ERROR;
}
