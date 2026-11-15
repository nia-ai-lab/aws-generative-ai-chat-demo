import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ToolCallDetails } from '../../src/components/ToolCallDetails';

describe('ToolCallDetails', () => {
  it('lists read and write HR tool calls and counts calls stopped by the application', () => {
    const html = renderToStaticMarkup(<ToolCallDetails toolCalls={[
      { name: 'get_leave_balance', label: '休暇の残日数を照会', access: 'read', status: 'success', summary: '年次有給休暇 残り10日' },
      { name: 'submit_leave_request', label: '休暇申請を提出', access: 'write', status: 'approval_required', summary: 'LV-ABC123 本人の承認待ちのため提出を停止' },
    ]} />);

    expect(html).toContain('人事ツールを2回実行しました（アプリが1件を止めました）');
    expect(html).toContain('読む');
    expect(html).toContain('書く');
    expect(html).toContain('停止（本人の承認待ち）');
    expect(html).not.toContain('<details class="tool-call-details" open');
  });

  it('renders nothing without tool calls', () => {
    expect(renderToStaticMarkup(<ToolCallDetails toolCalls={[]} />)).toBe('');
  });
});
