import type { APIGatewayProxyEvent } from 'aws-lambda';

export interface AuthContext {
  sub: string;
  groups: string[];
}

export function getAuthContext(event: APIGatewayProxyEvent): AuthContext {
  const authorizer = event.requestContext.authorizer;
  const sub = typeof authorizer?.sub === 'string' ? authorizer.sub : '';
  const groups = typeof authorizer?.groups === 'string'
    ? authorizer.groups.split(',').filter(Boolean)
    : [];
  if (!sub) throw new Error('UNAUTHORIZED');
  return { sub, groups };
}

export function requireAdmin(context: AuthContext): void {
  if (!isAdmin(context)) throw new Error('FORBIDDEN');
}

export function isAdmin(context: AuthContext): boolean {
  return context.groups.includes('Admins');
}

export function bearerToken(event: APIGatewayProxyEvent): string {
  const value = event.headers.Authorization ?? event.headers.authorization ?? '';
  const match = value.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new Error('UNAUTHORIZED');
  return match[1];
}
