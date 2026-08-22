import type {
  GuardrailAssessmentSummary,
  GuardrailTracePolicy,
  GuardrailTraceSummary,
} from '../../shared/api-schema';

const policyLabels: Record<GuardrailTracePolicy, string> = {
  content: 'コンテンツ保護',
  topic: '禁止トピック',
  word: '禁止ワード',
  'sensitive-information': '個人情報',
  'contextual-grounding': 'グラウンディング',
  'automated-reasoning': '自動推論',
};

const nameLabels: Record<string, string> = {
  HATE: 'ヘイト（HATE）',
  INSULTS: '侮辱（INSULTS）',
  SEXUAL: '性的内容（SEXUAL）',
  VIOLENCE: '暴力（VIOLENCE）',
  MISCONDUCT: '不正行為（MISCONDUCT）',
  PROMPT_ATTACK: 'プロンプト攻撃（PROMPT_ATTACK）',
  EMAIL: 'メールアドレス（EMAIL）',
  PHONE: '電話番号（PHONE）',
  Travel: '旅行（Travel）',
  CUSTOM_WORD: 'カスタム禁止ワード',
  MANAGED_WORD: 'マネージド禁止ワード',
  GROUNDING: '根拠との整合性（GROUNDING）',
  RELEVANCE: '質問との関連性（RELEVANCE）',
};

const actionLabels: Record<string, string> = {
  BLOCKED: 'ブロック',
  ANONYMIZED: '匿名化',
  DETECTED: '検出',
  NONE: '検出のみ',
};

const confidenceLabels: Record<string, string> = {
  HIGH: '高（HIGH）',
  MEDIUM: '中（MEDIUM）',
  LOW: '低（LOW）',
  NONE: 'なし（NONE）',
};

function summaryLabel(trace: GuardrailTraceSummary): string {
  if (trace.result === 'BLOCKED') return 'Guardrailがブロックしました';
  if (trace.result === 'ANONYMIZED') return 'Guardrailが匿名化しました';
  return 'Guardrailが検出しました';
}

function AssessmentDetails({ assessment }: { assessment: GuardrailAssessmentSummary }) {
  return (
    <li>
      <strong>
        {assessment.source === 'input' ? '入力' : '出力'} · {policyLabels[assessment.policy]}
      </strong>
      <dl>
        <div><dt>検出項目</dt><dd>{nameLabels[assessment.name] ?? assessment.name}</dd></div>
        <div><dt>アクション</dt><dd>{actionLabels[assessment.action] ?? assessment.action}</dd></div>
        {assessment.confidence && (
          <div><dt>信頼度</dt><dd>{confidenceLabels[assessment.confidence] ?? assessment.confidence}</dd></div>
        )}
        {assessment.filterStrength && (
          <div><dt>フィルター強度</dt><dd>{confidenceLabels[assessment.filterStrength] ?? assessment.filterStrength}</dd></div>
        )}
        {assessment.score !== undefined && (
          <div><dt>スコア</dt><dd>{assessment.score.toFixed(3)}</dd></div>
        )}
        {assessment.threshold !== undefined && (
          <div><dt>しきい値</dt><dd>{assessment.threshold.toFixed(3)}</dd></div>
        )}
      </dl>
    </li>
  );
}

export function GuardrailTraceDetails({ trace }: { trace: GuardrailTraceSummary }) {
  return (
    <details className="guardrail-trace-details">
      <summary>{summaryLabel(trace)}</summary>
      <div className="guardrail-trace-content">
        {trace.assessments.length > 0 ? (
          <ol>
            {trace.assessments.map((assessment, index) => (
              <AssessmentDetails
                assessment={assessment}
                key={`${assessment.source}-${assessment.policy}-${assessment.name}-${index}`}
              />
            ))}
          </ol>
        ) : <p>詳細な評価項目は取得できませんでした。</p>}
        {trace.guardrails.map((guardrail) => (
          <p className="guardrail-resource" key={`${guardrail.id}-${guardrail.version}`}>
            Guardrail {guardrail.id} · Version {guardrail.version}
          </p>
        ))}
      </div>
    </details>
  );
}
