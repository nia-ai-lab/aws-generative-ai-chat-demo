import { App, Stack, aws_cognito as cognito } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApplicationResources } from '../../amplify/custom/application-stack.js';

function synthesizeTemplate(): Template {
  const app = new App();
  const stack = new Stack(app, 'TestStack');
  const userPool = new cognito.UserPool(stack, 'UserPool');
  const userPoolClient = userPool.addClient('Client', { generateSecret: false });
  createApplicationResources(stack, { userPool, userPoolClient });
  return Template.fromStack(stack);
}

describe('application infrastructure', () => {
  let template: Template;

  beforeAll(() => {
    template = synthesizeTemplate();
  }, 20_000);

  it('uses Lambda access-token authorization and AgentCore JWT authorization', () => {
    template.resourceCountIs('AWS::ApiGateway::Authorizer', 1);
    template.hasResourceProperties('AWS::BedrockAgentCore::Runtime', {
      AuthorizerConfiguration: {
        CustomJWTAuthorizer: Match.objectLike({
          AllowedClients: Match.anyValue(),
          CustomClaims: Match.arrayWith([
            Match.objectLike({ InboundTokenClaimName: 'token_use' }),
          ]),
        }),
      },
    });
  });

  it('configures short-lived memory and encrypted seven-day logs', () => {
    template.hasResourceProperties('AWS::BedrockAgentCore::Memory', { EventExpiryDuration: 3 });
    template.hasResourceProperties('AWS::Logs::LogGroup', {
      RetentionInDays: 7,
      KmsKeyId: Match.anyValue(),
    });
  });

  it('grants the Runtime only the short-term Memory operations it uses', () => {
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: ['bedrock-agentcore:CreateEvent', 'bedrock-agentcore:ListEvents', 'bedrock-agentcore:GetEvent'],
            Effect: 'Allow',
          }),
        ]),
      },
    });
  });

  it('enables API Gateway streaming for the chat method', () => {
    const methods = template.findResources('AWS::ApiGateway::Method');
    expect(Object.values(methods).some((resource: any) =>
      resource.Properties?.HttpMethod === 'POST' &&
      resource.Properties?.Integration?.ResponseTransferMode === 'STREAM',
    )).toBe(true);
  });
});
