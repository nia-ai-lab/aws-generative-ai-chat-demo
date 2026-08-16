import type { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { chatRequestSchema, type ChatStreamEvent } from '../../../shared/api-schema.js';
import { MODEL_CATALOG } from '../../../shared/model-catalog.js';
import { expandPromptVariables } from '../../../shared/prompt-variables.js';
import { bearerToken, getAuthContext } from '../shared/auth.js';
import { readConfig } from '../shared/config.js';
import { corsHeaders } from '../shared/http.js';
import { actorId, runtimeSessionId } from '../shared/session-isolation.js';

interface LambdaResponseStream {
  write(chunk: string | Uint8Array): boolean;
  end(chunk?: string): void;
}

declare const awslambda: {
  streamifyResponse<TEvent>(handler: (event: TEvent, responseStream: LambdaResponseStream, context: Context) => Promise<void>): unknown;
  HttpResponseStream: {
    from(stream: LambdaResponseStream, metadata: { statusCode: number; headers: Record<string, string> }): LambdaResponseStream;
  };
};

function writeSse(stream: LambdaResponseStream, event: ChatStreamEvent): void {
  stream.write(`data: ${JSON.stringify(event)}\n\n`);
}

function runtimeUrl(runtimeArn: string): URL {
  const region = process.env.AWS_REGION ?? 'ap-northeast-1';
  const qualifier = process.env.AGENT_RUNTIME_QUALIFIER ?? 'live';
  return new URL(
    `https://bedrock-agentcore.${region}.amazonaws.com/runtimes/${encodeURIComponent(runtimeArn)}/invocations?qualifier=${encodeURIComponent(qualifier)}`,
  );
}

async function* parseAgentSse(body: ReadableStream<Uint8Array>): AsyncGenerator<ChatStreamEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const blocks = buffer.split(/\r?\n\r?\n/);
    buffer = blocks.pop() ?? '';
    for (const block of blocks) {
      const data = block.split(/\r?\n/).find((line) => line.startsWith('data:'))?.slice(5).trim();
      if (!data) continue;
      const parsed = JSON.parse(data) as ChatStreamEvent | { error?: string };
      if (!('type' in parsed)) throw new Error('AGENT_UNAVAILABLE');
      yield parsed as ChatStreamEvent;
    }
    if (done) break;
  }
}

function finishError(
  event: APIGatewayProxyEvent,
  originalStream: LambdaResponseStream,
  statusCode: number,
  code: string,
): void {
  const stream = awslambda.HttpResponseStream.from(originalStream, {
    statusCode,
    headers: { ...corsHeaders(event), 'Content-Type': 'application/json; charset=utf-8' },
  });
  stream.end(JSON.stringify({ code }));
}

export const handler = awslambda.streamifyResponse<APIGatewayProxyEvent>(async (event, originalStream) => {
  const startedAt = Date.now();
  const startedAtIso = new Date(startedAt).toISOString();
  let requestId = 'unknown';
  let conversationSessionId = 'unknown';
  let selectedModel = 'unknown';
  let auditActorId = 'unknown';
  let userMessage = '';
  let assistantMessage = '';
  let inputTokens: number | undefined;
  let outputTokens: number | undefined;
  let activeStream: LambdaResponseStream | undefined;

  try {
    const auth = getAuthContext(event);
    const token = bearerToken(event);
    const input = chatRequestSchema.parse(JSON.parse(event.body ?? '{}'));
    const config = await readConfig();
    requestId = input.requestId;
    conversationSessionId = input.conversationSessionId;
    selectedModel = input.modelKey;
    userMessage = input.message;
    auditActorId = actorId(auth.sub, input.browserSessionId);
    const isolatedRuntimeSessionId = runtimeSessionId(auditActorId, input.conversationSessionId);
    const promptContext = { now: new Date(), timeZone: input.timeZone };

    if (!config.enabledModelKeys.includes(input.modelKey)) {
      finishError(event, originalStream, 400, 'MODEL_NOT_ALLOWED');
      return;
    }

    const runtimeArn = process.env.AGENT_RUNTIME_ARN;
    if (!runtimeArn) throw new Error('AGENT_UNAVAILABLE');

    const response = await fetch(runtimeUrl(runtimeArn), {
      method: 'POST',
      headers: {
        Accept: 'text/event-stream',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Amzn-Bedrock-AgentCore-Runtime-Session-Id': isolatedRuntimeSessionId,
      },
      body: JSON.stringify({
        requestId: input.requestId,
        actorId: auditActorId,
        conversationSessionId: input.conversationSessionId,
        runtimeSessionId: isolatedRuntimeSessionId,
        modelId: MODEL_CATALOG[input.modelKey].inferenceProfileId,
        modelKey: input.modelKey,
        message: input.message,
        adminSystemPrompt: expandPromptVariables(config.defaultSystemPrompt, promptContext),
        userSystemPrompt: expandPromptVariables(input.userSystemPrompt, promptContext),
      }),
      signal: AbortSignal.timeout(85_000),
    });

    if (!response.ok || !response.body) {
      throw new Error(response.status === 429 ? 'RATE_LIMITED' : 'AGENT_UNAVAILABLE');
    }

    const stream = awslambda.HttpResponseStream.from(originalStream, {
      statusCode: 200,
      headers: {
        ...corsHeaders(event),
        'Content-Type': 'text/event-stream; charset=utf-8',
        'X-Accel-Buffering': 'no',
      },
    });
    activeStream = stream;
    writeSse(stream, { type: 'meta', requestId: input.requestId, modelKey: input.modelKey });

    for await (const agentEvent of parseAgentSse(response.body)) {
      if (agentEvent.type === 'delta') assistantMessage += agentEvent.text;
      if (agentEvent.type === 'done') {
        inputTokens = agentEvent.usage?.inputTokens;
        outputTokens = agentEvent.usage?.outputTokens;
      }
      writeSse(stream, agentEvent);
    }
    stream.end();

    console.info(JSON.stringify({
      eventType: 'CHAT_COMPLETED',
      startedAt: startedAtIso,
      completedAt: new Date().toISOString(),
      requestId,
      conversationSessionId,
      runtimeSessionId: isolatedRuntimeSessionId,
      actorId: auditActorId,
      modelKey: selectedModel,
      userMessage,
      assistantMessage,
      inputTokens,
      outputTokens,
      latencyMs: Date.now() - startedAt,
      result: 'SUCCESS',
    }));
  } catch (error) {
    const code = error instanceof SyntaxError || (typeof error === 'object' && error !== null && 'issues' in error)
      ? 'VALIDATION_ERROR'
      : error instanceof Error && ['UNAUTHORIZED', 'RATE_LIMITED', 'AGENT_UNAVAILABLE'].includes(error.message)
        ? error.message
        : 'INTERNAL_ERROR';
    const status = code === 'UNAUTHORIZED' ? 401 : code === 'VALIDATION_ERROR' ? 400 : code === 'RATE_LIMITED' ? 429 : 503;
    if (activeStream) {
      writeSse(activeStream, { type: 'error', code, message: 'The request could not be completed.' });
      activeStream.end();
    } else {
      finishError(event, originalStream, status, code);
    }
    console.error(JSON.stringify({
      eventType: 'CHAT_FAILED',
      startedAt: startedAtIso,
      completedAt: new Date().toISOString(),
      requestId,
      conversationSessionId,
      actorId: auditActorId,
      modelKey: selectedModel,
      userMessage,
      assistantMessage,
      inputTokens,
      outputTokens,
      latencyMs: Date.now() - startedAt,
      result: code,
      errorType: error instanceof Error ? error.name : 'UnknownError',
    }));
  }
});
