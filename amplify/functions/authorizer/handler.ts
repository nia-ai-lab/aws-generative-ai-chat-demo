import type { APIGatewayAuthorizerResult, APIGatewayTokenAuthorizerEvent, Callback, Context } from 'aws-lambda';
import { CognitoJwtVerifier } from 'aws-jwt-verify';

let verifier: ReturnType<typeof CognitoJwtVerifier.create> | undefined;

function getVerifier() {
  const userPoolId = process.env.USER_POOL_ID;
  const clientId = process.env.USER_POOL_CLIENT_ID;
  if (!userPoolId || !clientId) throw new Error('Authorizer is not configured.');
  verifier ??= CognitoJwtVerifier.create({ userPoolId, clientId, tokenUse: 'access' });
  return verifier;
}

function policy(principalId: string, effect: 'Allow' | 'Deny', methodArn: string, context = {}): APIGatewayAuthorizerResult {
  const arnParts = methodArn.split('/');
  const resourceArn = `${arnParts[0]}/${arnParts[1]}/*`;
  return {
    principalId,
    policyDocument: {
      Version: '2012-10-17',
      Statement: [{ Action: 'execute-api:Invoke', Effect: effect, Resource: resourceArn }],
    },
    context,
  };
}

export async function handler(
  event: APIGatewayTokenAuthorizerEvent,
  _context: Context,
  callback: Callback<APIGatewayAuthorizerResult>,
): Promise<void> {
  try {
    const match = event.authorizationToken.match(/^Bearer\s+(.+)$/i);
    if (!match) return callback('Unauthorized');
    const payload = await getVerifier().verify(match[1]);
    const groups = Array.isArray(payload['cognito:groups']) ? payload['cognito:groups'].join(',') : '';
    callback(null, policy(payload.sub, 'Allow', event.methodArn, {
      sub: payload.sub,
      groups,
      clientId: payload.client_id,
      tokenUse: payload.token_use,
    }));
  } catch {
    callback('Unauthorized');
  }
}
