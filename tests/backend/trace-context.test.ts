import { describe, expect, it } from 'vitest';
import { propagatedTraceHeaders } from '../../amplify/functions/shared/trace-context.js';

describe('trace context propagation', () => {
  it('forwards standard W3C and X-Ray headers without creating a custom identifier', () => {
    expect(propagatedTraceHeaders({
      TraceParent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
      tracestate: 'vendor=value',
      'X-Amzn-Trace-Id': 'Root=1-abc;Parent=def;Sampled=1',
      'x-custom-correlation-id': 'do-not-forward',
    })).toEqual({
      traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
      tracestate: 'vendor=value',
      'x-amzn-trace-id': 'Root=1-abc;Parent=def;Sampled=1',
    });
  });

  it('uses the Lambda X-Ray context only when the incoming request has no X-Ray header', () => {
    expect(propagatedTraceHeaders({}, 'Root=1-runtime;Parent=lambda;Sampled=1')).toEqual({
      'x-amzn-trace-id': 'Root=1-runtime;Parent=lambda;Sampled=1',
    });
  });
});
