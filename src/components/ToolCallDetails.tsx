import type { ToolCallSummary } from '../../shared/api-schema';

const statusLabels: Record<ToolCallSummary['status'], string> = {
  success: '成功',
  denied: '拒否（本人以外）',
  approval_required: '停止（本人の承認待ち）',
  error: 'エラー',
};

function summaryLabel(toolCalls: ToolCallSummary[]): string {
  const stopped = toolCalls.filter((call) => call.status === 'denied' || call.status === 'approval_required').length;
  const base = `人事ツールを${toolCalls.length}回実行しました`;
  return stopped > 0 ? `${base}（アプリが${stopped}件を止めました）` : base;
}

export function ToolCallDetails({ toolCalls }: { toolCalls: ToolCallSummary[] }) {
  if (toolCalls.length === 0) return null;

  return (
    <details className="tool-call-details">
      <summary>{summaryLabel(toolCalls)}</summary>
      <ol>
        {toolCalls.map((call, index) => (
          <li key={`${call.name}-${index}`} className={`tool-call-${call.status}`}>
            <span className={`tool-call-access ${call.access}`}>{call.access === 'write' ? '書く' : '読む'}</span>
            <div>
              <strong>{index + 1}. {call.label}</strong>
              <span className="tool-call-status">{statusLabels[call.status]}</span>
              {call.summary && <p>{call.summary}</p>}
            </div>
          </li>
        ))}
      </ol>
    </details>
  );
}
