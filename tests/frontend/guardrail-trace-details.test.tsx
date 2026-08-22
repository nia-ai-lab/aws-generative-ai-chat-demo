import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { GuardrailTraceDetails } from '../../src/components/GuardrailTraceDetails';

describe('GuardrailTraceDetails', () => {
  it('renders a closed disclosure with sanitized intervention details', () => {
    const html = renderToStaticMarkup(<GuardrailTraceDetails trace={{
      result: 'BLOCKED',
      guardrails: [{ id: 'guardrail-id', version: '2' }],
      assessments: [
        {
          source: 'input',
          policy: 'topic',
          name: 'Travel',
          action: 'BLOCKED',
          detected: true,
        },
        {
          source: 'output',
          policy: 'content',
          name: 'VIOLENCE',
          action: 'BLOCKED',
          confidence: 'HIGH',
          filterStrength: 'MEDIUM',
        },
      ],
    }} />);

    expect(html).toContain('<details class="guardrail-trace-details">');
    expect(html).not.toContain('<details class="guardrail-trace-details" open');
    expect(html).toContain('Guardrailがブロックしました');
    expect(html).toContain('入力 · 禁止トピック');
    expect(html).toContain('旅行（Travel）');
    expect(html).toContain('出力 · コンテンツ保護');
    expect(html).toContain('高（HIGH）');
    expect(html).toContain('Guardrail guardrail-id · Version 2');
  });

  it('labels anonymization separately from blocking', () => {
    const html = renderToStaticMarkup(<GuardrailTraceDetails trace={{
      result: 'ANONYMIZED',
      guardrails: [],
      assessments: [{
        source: 'input',
        policy: 'sensitive-information',
        name: 'EMAIL',
        action: 'ANONYMIZED',
      }],
    }} />);

    expect(html).toContain('Guardrailが匿名化しました');
    expect(html).toContain('メールアドレス（EMAIL）');
  });
});
