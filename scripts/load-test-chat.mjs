import { randomUUID } from 'node:crypto';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Amplify } from 'aws-amplify';
import { fetchAuthSession, signIn } from 'aws-amplify/auth';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(scriptDirectory, '..');
const supportedModels = new Set(['claude-sonnet-5', 'nova-micro', 'nova-2-lite', 'nova-pro']);
const supportedTools = new Set(['web-search', 'rag']);

function integerSetting(name, fallback, minimum, maximum) {
  const raw = process.env[name];
  const value = raw === undefined ? fallback : Number.parseInt(raw, 10);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be an integer from ${minimum} to ${maximum}.`);
  }
  return value;
}

function booleanSetting(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  throw new Error(`${name} must be true or false.`);
}

function percentile(values, percentileValue) {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.ceil((percentileValue / 100) * sorted.length) - 1;
  return Math.round(sorted[Math.max(0, index)]);
}

function summarize(results) {
  const successful = results.filter((result) => result.success);
  const firstDeltaValues = successful
    .map((result) => result.firstDeltaMs)
    .filter((value) => value !== undefined);
  const totalValues = successful.map((result) => result.totalMs);
  const statuses = {};
  const errors = {};
  for (const result of results) {
    const status = String(result.httpStatus ?? 'network');
    statuses[status] = (statuses[status] ?? 0) + 1;
    if (result.errorCode) errors[result.errorCode] = (errors[result.errorCode] ?? 0) + 1;
  }
  return {
    requested: results.length,
    succeeded: successful.length,
    successRate: results.length === 0 ? 0 : Number((successful.length / results.length).toFixed(4)),
    statuses,
    errors,
    firstDeltaMs: {
      p50: percentile(firstDeltaValues, 50),
      p95: percentile(firstDeltaValues, 95),
      max: percentile(firstDeltaValues, 100),
    },
    totalMs: {
      p50: percentile(totalValues, 50),
      p95: percentile(totalValues, 95),
      max: percentile(totalValues, 100),
    },
  };
}

function parseSseBlock(block) {
  const data = block
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart())
    .join('\n');
  return data ? JSON.parse(data) : undefined;
}

async function loadOutputs() {
  const outputsPath = process.env.LOAD_TEST_OUTPUTS_FILE
    ? path.resolve(process.env.LOAD_TEST_OUTPUTS_FILE)
    : path.join(projectDirectory, 'amplify_outputs.json');
  return JSON.parse(await readFile(outputsPath, 'utf8'));
}

async function acquireAccessToken(outputs) {
  if (process.env.LOAD_TEST_ACCESS_TOKEN) return process.env.LOAD_TEST_ACCESS_TOKEN;
  const username = process.env.LOAD_TEST_USERNAME;
  const password = process.env.LOAD_TEST_PASSWORD;
  if (!username || !password) throw new Error('LOAD_TEST_USERNAME and LOAD_TEST_PASSWORD are required.');

  Amplify.configure(outputs);
  const result = await signIn({ username, password });
  if (result.nextStep.signInStep !== 'DONE') {
    throw new Error(`Unsupported Cognito sign-in step: ${result.nextStep.signInStep}`);
  }
  const session = await fetchAuthSession();
  const token = session.tokens?.accessToken?.toString();
  if (!token) throw new Error('Cognito did not return an access token.');
  return token;
}

async function invokeChat({ apiUrl, accessToken, session, message, modelKey, toolKeys, timeoutMs }) {
  const startedAt = performance.now();
  const requestId = randomUUID();
  let response;
  try {
    response = await fetch(new URL('chat', apiUrl), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requestId,
        browserSessionId: session.browserSessionId,
        conversationSessionId: session.conversationSessionId,
        modelKey,
        message,
        userSystemPrompt: '',
        guardrailKeys: [],
        toolKeys,
        timeZone: 'Asia/Tokyo',
        generationConfig: {
          temperature: 0.1,
          topP: null,
          maxOutputTokens: 128,
        },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    return {
      requestId,
      index: session.index,
      success: false,
      totalMs: Math.round(performance.now() - startedAt),
      errorCode: error instanceof Error ? error.name : 'NETWORK_ERROR',
    };
  }

  const responseStartedAt = performance.now();
  if (!response.ok || !response.body) {
    const body = await response.json().catch(() => ({}));
    return {
      requestId,
      index: session.index,
      success: false,
      httpStatus: response.status,
      responseStartedMs: Math.round(responseStartedAt - startedAt),
      totalMs: Math.round(performance.now() - startedAt),
      errorCode: body.code ?? `HTTP_${response.status}`,
    };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let firstDeltaMs;
  let responseText = '';
  let doneEvent = false;
  let errorCode;

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const blocks = buffer.split(/\r?\n\r?\n/);
    buffer = blocks.pop() ?? '';
    for (const block of blocks) {
      const event = parseSseBlock(block);
      if (!event) continue;
      if (event.type === 'delta') {
        if (firstDeltaMs === undefined) firstDeltaMs = Math.round(performance.now() - startedAt);
        responseText += event.text;
      } else if (event.type === 'done') {
        doneEvent = true;
      } else if (event.type === 'error') {
        errorCode = event.code;
      }
    }
    if (done) break;
  }

  if (buffer.trim()) {
    const event = parseSseBlock(buffer);
    if (event?.type === 'delta') {
      if (firstDeltaMs === undefined) firstDeltaMs = Math.round(performance.now() - startedAt);
      responseText += event.text;
    } else if (event?.type === 'done') {
      doneEvent = true;
    } else if (event?.type === 'error') {
      errorCode = event.code;
    }
  }

  return {
    requestId,
    index: session.index,
    success: response.ok && doneEvent && !errorCode,
    httpStatus: response.status,
    responseStartedMs: Math.round(responseStartedAt - startedAt),
    firstDeltaMs,
    totalMs: Math.round(performance.now() - startedAt),
    errorCode,
    responseText,
  };
}

async function runBatch({ sessions, messageFor, rampMs, ...invocation }) {
  return Promise.all(sessions.map(async (session, index) => {
    if (rampMs > 0 && sessions.length > 1) {
      await new Promise((resolve) => setTimeout(resolve, Math.round((index * rampMs) / (sessions.length - 1))));
    }
    return invokeChat({ ...invocation, session, message: messageFor(session) });
  }));
}

async function main() {
  const testStartedAt = new Date().toISOString();
  const outputs = await loadOutputs();
  const apiUrl = process.env.LOAD_TEST_API_URL ?? outputs.custom?.apiUrl;
  if (!apiUrl) throw new Error('The API URL was not found.');

  const concurrency = integerSetting('LOAD_TEST_CONCURRENCY', 30, 1, 100);
  const rampMs = integerSetting('LOAD_TEST_RAMP_MS', 0, 0, 60_000);
  const timeoutMs = integerSetting('LOAD_TEST_TIMEOUT_MS', 95_000, 1_000, 120_000);
  const roundGapMs = integerSetting('LOAD_TEST_ROUND_GAP_MS', 2_000, 0, 60_000);
  const warmup = booleanSetting('LOAD_TEST_WARMUP', true);
  const modelKey = process.env.LOAD_TEST_MODEL ?? 'nova-micro';
  if (!supportedModels.has(modelKey)) throw new Error(`Unsupported model: ${modelKey}`);
  const toolKeys = (process.env.LOAD_TEST_TOOL_KEYS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  if (toolKeys.some((key) => !supportedTools.has(key))) throw new Error('LOAD_TEST_TOOL_KEYS is invalid.');

  const accessToken = await acquireAccessToken(outputs);
  const nicknameAdjectives = ['赤い', '青い', '緑の', '黄色い', '白い', '黒い', '紫の', '桃色の', '銀色の', '金色の'];
  const nicknameAnimals = ['パンダ', 'キツネ', 'イルカ'];
  const sessions = Array.from({ length: concurrency }, (_, index) => ({
    index,
    browserSessionId: randomUUID(),
    conversationSessionId: randomUUID(),
    nickname: index < nicknameAdjectives.length * nicknameAnimals.length
      ? `${nicknameAdjectives[index % nicknameAdjectives.length]}${nicknameAnimals[Math.floor(index / nicknameAdjectives.length)]}`
      : `青空パンダ${index + 1}号`,
  }));
  const invocation = { apiUrl, accessToken, modelKey, toolKeys, timeoutMs };

  let baseline;
  if (warmup) {
    baseline = await invokeChat({
      ...invocation,
      session: { index: -1, browserSessionId: randomUUID(), conversationSessionId: randomUUID() },
      message: '1+1を数字だけで答えてください。',
    });
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }

  const firstTurn = await runBatch({
    ...invocation,
    sessions,
    rampMs,
    messageFor: (session) => `この会話では、私のニックネームは「${session.nickname}」です。覚えて「覚えました」とだけ答えてください。`,
  });
  await new Promise((resolve) => setTimeout(resolve, roundGapMs));

  const firstTurnSuccessfulSessions = sessions.filter((session) => firstTurn[session.index]?.success);
  const secondTurn = await runBatch({
    ...invocation,
    sessions: firstTurnSuccessfulSessions,
    rampMs,
    messageFor: () => '私のニックネームを、ニックネームだけで答えてください。',
  });

  const isolation = secondTurn.map((result) => {
    const session = sessions[result.index];
    const leakedNicknames = sessions
      .filter((candidate) => candidate.index !== result.index && result.responseText?.includes(candidate.nickname))
      .map((candidate) => candidate.index);
    return {
      index: result.index,
      ownNicknameFound: result.responseText?.includes(session.nickname) ?? false,
      leakedSessionIndexes: leakedNicknames,
    };
  });
  const isolationPassed = isolation.length === concurrency
    && isolation.every((result) => result.ownNicknameFound && result.leakedSessionIndexes.length === 0);

  const report = {
    startedAt: testStartedAt,
    generatedAt: new Date().toISOString(),
    configuration: {
      concurrency,
      rampMs,
      roundGapMs,
      modelKey,
      toolKeys,
      warmup,
      authentication: process.env.LOAD_TEST_ACCESS_TOKEN ? 'provided-access-token' : 'cognito-srp',
    },
    baseline: baseline ? {
      success: baseline.success,
      httpStatus: baseline.httpStatus,
      firstDeltaMs: baseline.firstDeltaMs,
      totalMs: baseline.totalMs,
      errorCode: baseline.errorCode,
    } : undefined,
    firstTurn: summarize(firstTurn),
    secondTurn: summarize(secondTurn),
    isolation: {
      passed: isolationPassed,
      checked: isolation.length,
      failures: isolation.filter((result) => !result.ownNicknameFound || result.leakedSessionIndexes.length > 0),
    },
    failedRequests: [...firstTurn, ...secondTurn]
      .filter((result) => !result.success)
      .map(({ requestId, index, httpStatus, errorCode, totalMs }) => ({
        requestId,
        index,
        httpStatus,
        errorCode,
        totalMs,
      })),
  };

  const reportPath = path.resolve(
    process.env.LOAD_TEST_REPORT_PATH ?? path.join(projectDirectory, 'tmp/load-test-report.json'),
  );
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  await chmod(reportPath, 0o600);
  console.log(JSON.stringify(report, null, 2));
  console.log(`Report: ${reportPath}`);

  if (report.firstTurn.successRate < 1 || report.secondTurn.successRate < 1 || !isolationPassed) {
    process.exitCode = 1;
  }
}

await main();
