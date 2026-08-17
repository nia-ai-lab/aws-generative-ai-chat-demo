import {
  BedrockAgentCoreControlClient,
  ConflictException,
  CreateGatewayCommand,
  CreateGatewayTargetCommand,
  DeleteGatewayCommand,
  DeleteGatewayTargetCommand,
  GetGatewayCommand,
  paginateListGateways,
  paginateListGatewayTargets,
  ResourceNotFoundException,
} from '@aws-sdk/client-bedrock-agentcore-control';

interface ProviderEvent {
  RequestType: 'Create' | 'Update' | 'Delete';
  PhysicalResourceId?: string;
  ResourceProperties: {
    GatewayName: string;
    GatewayRoleArn: string;
    ServiceToken: string;
  };
  CallbackContext?: { operation?: string };
}

interface ProviderResponse {
  PhysicalResourceId?: string;
  Data?: Record<string, string>;
  CallbackContext?: { operation: string };
  IsComplete?: boolean;
}

const region = process.env.TARGET_REGION ?? 'us-east-1';
const targetName = 'web-search-tool';
const client = new BedrockAgentCoreControlClient({ region, maxAttempts: 4 });

async function findGateway(name: string) {
  for await (const page of paginateListGateways({ client }, { maxResults: 100 })) {
    const gateway = page.items?.find((item) => item.name === name);
    if (gateway) return gateway;
  }
  return undefined;
}

async function listTargets(gatewayId: string) {
  const targets = [];
  for await (const page of paginateListGatewayTargets(
    { client },
    { gatewayIdentifier: gatewayId, maxResults: 100 },
  )) {
    targets.push(...(page.items ?? []));
  }
  return targets;
}

export async function onEvent(event: ProviderEvent): Promise<ProviderResponse> {
  const gatewayName = event.ResourceProperties.GatewayName;
  if (event.RequestType === 'Delete') {
    const gatewayId = event.PhysicalResourceId;
    if (!gatewayId) return { IsComplete: true };
    try {
      const targets = await listTargets(gatewayId);
      await Promise.all(targets.flatMap((target) => target.targetId ? [client.send(new DeleteGatewayTargetCommand({
        gatewayIdentifier: gatewayId,
        targetId: target.targetId,
      }))] : []));
    } catch (error) {
      if (!(error instanceof ResourceNotFoundException)) throw error;
    }
    return {
      PhysicalResourceId: gatewayId,
      CallbackContext: { operation: 'delete' },
    };
  }

  const gateway = await findGateway(gatewayName);
  let gatewayId = gateway?.gatewayId;
  if (!gatewayId) {
    const created = await client.send(new CreateGatewayCommand({
      name: gatewayName,
      description: 'Managed Web Search Gateway for the Generative AI Chat training demo.',
      roleArn: event.ResourceProperties.GatewayRoleArn,
      protocolType: 'MCP',
      protocolConfiguration: { mcp: { supportedVersions: ['2025-03-26'] } },
      authorizerType: 'AWS_IAM',
      tags: { Application: 'GenerativeAIChat', Environment: 'Training' },
    }));
    gatewayId = created.gatewayId;
    if (!gatewayId) throw new Error('CreateGateway did not return a gateway ID.');
    return {
      PhysicalResourceId: gatewayId,
      Data: { GatewayUrl: created.gatewayUrl ?? '' },
      CallbackContext: { operation: 'create' },
    };
  }

  const detail = await client.send(new GetGatewayCommand({ gatewayIdentifier: gatewayId }));
  return {
    PhysicalResourceId: gatewayId,
    Data: { GatewayUrl: detail.gatewayUrl ?? '' },
    CallbackContext: { operation: 'create' },
  };
}

export async function isComplete(event: ProviderEvent): Promise<ProviderResponse> {
  const gatewayId = event.PhysicalResourceId;
  if (!gatewayId) return { IsComplete: event.RequestType === 'Delete' };

  if (event.RequestType === 'Delete' || event.CallbackContext?.operation === 'delete') {
    try {
      const targets = await listTargets(gatewayId);
      if (targets.length > 0) return { IsComplete: false };
      try {
        await client.send(new DeleteGatewayCommand({ gatewayIdentifier: gatewayId }));
      } catch (error) {
        if (!(error instanceof ConflictException) && !(error instanceof ResourceNotFoundException)) throw error;
      }
      await client.send(new GetGatewayCommand({ gatewayIdentifier: gatewayId }));
      return { IsComplete: false };
    } catch (error) {
      if (error instanceof ResourceNotFoundException) return { IsComplete: true };
      throw error;
    }
  }

  const gateway = await client.send(new GetGatewayCommand({ gatewayIdentifier: gatewayId }));
  if (gateway.status === 'FAILED' || gateway.status === 'UPDATE_UNSUCCESSFUL') {
    throw new Error(`Gateway provisioning failed: ${(gateway.statusReasons ?? []).join('; ')}`);
  }
  if (gateway.status !== 'READY') return { IsComplete: false };

  const targets = await listTargets(gatewayId);
  const target = targets.find((item) => item.name === targetName);
  if (!target) {
    await client.send(new CreateGatewayTargetCommand({
      gatewayIdentifier: gatewayId,
      name: targetName,
      description: 'Amazon Bedrock AgentCore managed Web Search connector.',
      targetConfiguration: {
        mcp: {
          connector: {
            source: { connectorId: 'web-search', version: '1.2.0' },
            configurations: [{ name: 'WebSearch', parameterValues: {} }],
          },
        },
      },
      credentialProviderConfigurations: [{ credentialProviderType: 'GATEWAY_IAM_ROLE' }],
    }));
    return { IsComplete: false };
  }
  if (target.status === 'FAILED' || target.status === 'SYNCHRONIZE_UNSUCCESSFUL' || target.status === 'UPDATE_UNSUCCESSFUL') {
    throw new Error(`Web Search target provisioning failed with status ${target.status}.`);
  }
  return {
    IsComplete: target.status === 'READY',
    Data: { GatewayUrl: gateway.gatewayUrl ?? '' },
  };
}
