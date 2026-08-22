const PROPAGATED_TRACE_HEADERS = ['traceparent', 'tracestate', 'x-amzn-trace-id'] as const;

export function propagatedTraceHeaders(
  incoming: Record<string, string | undefined> | null,
  lambdaXrayTraceId?: string,
): Record<string, string> {
  const normalized = new Map(
    Object.entries(incoming ?? {}).map(([name, value]) => [name.toLowerCase(), value]),
  );
  const result: Record<string, string> = {};
  for (const name of PROPAGATED_TRACE_HEADERS) {
    const value = normalized.get(name);
    if (value) result[name] = value;
  }
  if (!result['x-amzn-trace-id'] && lambdaXrayTraceId) {
    result['x-amzn-trace-id'] = lambdaXrayTraceId;
  }
  return result;
}
