import { fetchAuthSession } from 'aws-amplify/auth';
import outputs from '../../amplify_outputs.json';
import {
  adminConfigSchema,
  publicConfigSchema,
  type AdminConfig,
  type ChatRequest,
  type PublicConfig,
  type UpdateAdminConfig,
} from '../../shared/api-schema';
import { readSse } from './sse';

const custom = outputs.custom as { apiUrl?: string } | undefined;
const apiUrl = custom?.apiUrl;

async function accessToken(): Promise<string> {
  const session = await fetchAuthSession();
  const token = session.tokens?.accessToken?.toString();
  if (!token) throw new Error('UNAUTHORIZED');
  return token;
}

async function authenticatedFetch(path: string, init?: RequestInit): Promise<Response> {
  if (!apiUrl) throw new Error('API URL is not configured.');
  const token = await accessToken();
  const headers = new Headers(init?.headers);
  headers.set('Authorization', `Bearer ${token}`);
  if (init?.body) headers.set('Content-Type', 'application/json');

  return fetch(new URL(path.replace(/^\//, ''), apiUrl), {
    ...init,
    headers,
  });
}

async function requireJson(response: Response): Promise<unknown> {
  const body = (await response.json().catch(() => ({}))) as { code?: string; message?: string };
  if (!response.ok) throw new Error(body.code ?? `HTTP_${response.status}`);
  return body;
}

export async function getConfig(): Promise<PublicConfig> {
  return publicConfigSchema.parse(await requireJson(await authenticatedFetch('/config')));
}

export async function getAdminConfig(): Promise<AdminConfig> {
  return adminConfigSchema.parse(await requireJson(await authenticatedFetch('/admin/config')));
}

export async function updateAdminConfig(value: UpdateAdminConfig): Promise<AdminConfig> {
  const response = await authenticatedFetch('/admin/config', {
    method: 'PUT',
    body: JSON.stringify(value),
  });
  return adminConfigSchema.parse(await requireJson(response));
}

export async function* streamChat(request: ChatRequest, signal: AbortSignal) {
  const response = await authenticatedFetch('/chat', {
    method: 'POST',
    body: JSON.stringify(request),
    signal,
  });

  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as { code?: string };
    throw new Error(error.code ?? `HTTP_${response.status}`);
  }

  yield* readSse(response);
}
