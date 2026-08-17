import type { ModelUsage } from '../../shared/model-pricing';
import type { ToolUsage } from '../../shared/api-schema';

interface UsageCostDetailsProps {
  modelLabel: string;
  usage: ModelUsage;
  toolUsage?: ToolUsage;
}

const tokenFormatter = new Intl.NumberFormat('ja-JP');
const costFormatter = new Intl.NumberFormat('ja-JP', {
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
});

function formatJpy(value: number): string {
  if (value > 0 && value < 0.0001) return '< ¥0.0001';
  return `¥${costFormatter.format(value)}`;
}

export function UsageCostDetails({ modelLabel, usage, toolUsage }: UsageCostDetailsProps) {
  const estimate = usage.estimate;
  if (
    !estimate
    || usage.inputTokens === undefined
    || usage.outputTokens === undefined
  ) return null;

  return (
    <details className="usage-cost-details">
      <summary>利用量・モデル推論料金（概算）</summary>
      <div className="usage-cost-content">
        <dl>
          <div>
            <dt>Input {tokenFormatter.format(usage.inputTokens)} tokens</dt>
            <dd>{formatJpy(estimate.inputCostJpy)}</dd>
          </div>
          <div>
            <dt>Output {tokenFormatter.format(usage.outputTokens)} tokens</dt>
            <dd>{formatJpy(estimate.outputCostJpy)}</dd>
          </div>
          <div className="usage-cost-total">
            <dt>合計</dt>
            <dd>{formatJpy(estimate.totalCostJpy)}</dd>
          </div>
        </dl>
        <p>{modelLabel}</p>
        <p>
          Input ${estimate.inputUsdPerMillionTokens} / Output ${estimate.outputUsdPerMillionTokens}
          （100万tokens）
        </p>
        <p>1 USD = ¥{estimate.usdToJpyRate} / 料金確認日 {estimate.priceVerifiedAt}</p>
        <p>モデル推論のみ。実際の請求額とは異なる場合があります。</p>
        {toolUsage && (toolUsage.webSearchQueries > 0 || toolUsage.ragRetrievals > 0) && (
          <div className="tool-usage-summary">
            {toolUsage.webSearchQueries > 0 && (
              <p>
                Web検索 {toolUsage.webSearchQueries}回
                {toolUsage.webSearchCostJpy !== undefined && ` / 約${formatJpy(toolUsage.webSearchCostJpy)}`}
              </p>
            )}
            {toolUsage.ragRetrievals > 0 && <p>RAG検索 {toolUsage.ragRetrievals}回</p>}
          </div>
        )}
      </div>
    </details>
  );
}
