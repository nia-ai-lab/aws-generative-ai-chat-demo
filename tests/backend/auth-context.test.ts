import { describe, expect, it } from 'vitest';
import type { APIGatewayProxyEvent } from 'aws-lambda';
import { getAuthContext, isAdmin, requireAdmin } from '../../amplify/functions/shared/auth.js';

function eventWithContext(authorizer: Record<string, unknown>): APIGatewayProxyEvent {
  return {
    requestContext: { authorizer },
  } as unknown as APIGatewayProxyEvent;
}

describe('API authorization context', () => {
  it('parses groups supplied by the Lambda authorizer', () => {
    expect(getAuthContext(eventWithContext({ sub: 'subject', groups: 'Students,Admins' }))).toEqual({
      sub: 'subject',
      groups: ['Students', 'Admins'],
    });
  });

  it('rejects a student on admin routes', () => {
    expect(() => requireAdmin({ sub: 'subject', groups: ['Students'] })).toThrow('FORBIDDEN');
    expect(isAdmin({ sub: 'subject', groups: ['Students'] })).toBe(false);
    expect(isAdmin({ sub: 'subject', groups: ['Admins'] })).toBe(true);
  });
});
