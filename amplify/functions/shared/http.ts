import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

const AMPLIFY_ORIGIN = /^https:\/\/[a-z0-9-]+\.[a-z0-9-]+\.amplifyapp\.com$/i;
const LOCAL_ORIGIN = /^http:\/\/localhost(?::\d{2,5})?$/;

export function allowedOrigin(event: Pick<APIGatewayProxyEvent, 'headers'>): string | undefined {
  const origin = event.headers.origin ?? event.headers.Origin;
  if (!origin) return undefined;
  const explicitOrigins = (process.env.ALLOWED_ORIGINS ?? '').split(',').map((value) => value.trim()).filter(Boolean);
  if (explicitOrigins.includes(origin) || AMPLIFY_ORIGIN.test(origin) || LOCAL_ORIGIN.test(origin)) return origin;
  return undefined;
}

export function corsHeaders(event: Pick<APIGatewayProxyEvent, 'headers'>): Record<string, string> {
  const origin = allowedOrigin(event);
  return {
    ...(origin ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {}),
    'Access-Control-Allow-Headers': 'Authorization,Content-Type',
    'Access-Control-Allow-Methods': 'GET,PUT,POST,OPTIONS',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  };
}

export function jsonResponse(
  event: Pick<APIGatewayProxyEvent, 'headers'>,
  statusCode: number,
  body: unknown,
): APIGatewayProxyResult {
  return {
    statusCode,
    headers: { ...corsHeaders(event), 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  };
}

export function errorResponse(
  event: Pick<APIGatewayProxyEvent, 'headers'>,
  statusCode: number,
  code: string,
): APIGatewayProxyResult {
  return jsonResponse(event, statusCode, { code });
}
