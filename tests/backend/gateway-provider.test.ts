import { describe, expect, it } from 'vitest';
import { gatewayRegion } from '../../amplify/functions/gateway-provider/handler.js';

const baseProperties = {
  GatewayName: 'generative-ai-chat-web-search',
  GatewayRoleArn: 'arn:aws:iam::123456789012:role/example',
  ServiceToken: 'arn:aws:lambda:ap-northeast-1:123456789012:function:example',
};

describe('Web Search gateway provider region', () => {
  it('uses the region declared on the custom resource', () => {
    expect(gatewayRegion({ ResourceProperties: { ...baseProperties, Region: 'ap-northeast-1' } }))
      .toBe('ap-northeast-1');
  });

  it('treats gateways created without a Region property as legacy us-east-1 resources', () => {
    expect(gatewayRegion({ ResourceProperties: baseProperties })).toBe('us-east-1');
  });
});
