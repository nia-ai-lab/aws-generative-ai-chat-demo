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

    const runtimeRetentions = Object.values(template.findResources('Custom::LogRetention'))
      .filter((resource: any) =>
        resource.Properties?.RetentionInDays === 7 &&
        JSON.stringify(resource.Properties?.LogGroupName).includes('/aws/bedrock-agentcore/runtimes/'),
      );
    expect(runtimeRetentions).toHaveLength(2);
    expect(runtimeRetentions.every((resource: any) =>
      resource.DependsOn?.some((logicalId: string) => logicalId.includes('ChatAgentRuntime')),
    )).toBe(true);

    const runtimeEncryptionResources = Object.values(template.findResources('Custom::AWS'))
      .filter((resource: any) => JSON.stringify(resource.Properties?.Create).includes('associateKmsKey'));
    expect(runtimeEncryptionResources).toHaveLength(2);
    expect(runtimeEncryptionResources.every((resource: any) =>
      JSON.stringify(resource.Properties?.Delete).includes('disassociateKmsKey'),
    )).toBe(true);
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

  it('creates versioned opt-in guardrail presets and their combinations', () => {
    template.resourceCountIs('AWS::Bedrock::Guardrail', 31);
    template.resourceCountIs('AWS::Bedrock::GuardrailVersion', 31);
    template.hasResourceProperties('AWS::Bedrock::GuardrailVersion', {
      Description: 'Immutable training definition v2',
    });
    template.hasResourceProperties('AWS::Bedrock::Guardrail', {
      TopicPolicyConfig: {
        TopicsConfig: Match.arrayWith([Match.objectLike({ Name: 'Travel', Type: 'DENY' })]),
        TopicsTierConfig: { TierName: 'STANDARD' },
      },
    });
    template.hasResourceProperties('AWS::Bedrock::Guardrail', {
      WordPolicyConfig: {
        WordsConfig: Match.arrayWith([Match.objectLike({ Text: 'pineapple' })]),
      },
    });
  });
});
