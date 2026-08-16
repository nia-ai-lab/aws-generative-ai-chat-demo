import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  Duration,
  RemovalPolicy,
  Stack,
  aws_apigateway as apigateway,
  aws_bedrock as bedrock,
  aws_bedrockagentcore as agentcore,
  aws_cognito as cognito,
  aws_dynamodb as dynamodb,
  aws_iam as iam,
  aws_kms as kms,
  aws_lambda as lambda,
  aws_lambda_nodejs as lambdaNode,
  aws_logs as logs,
} from 'aws-cdk-lib';
import type { Construct } from 'constructs';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(currentDirectory, '../..');

interface ApplicationStackProps {
  userPool: cognito.IUserPool;
  userPoolClient: cognito.IUserPoolClient;
}

function functionLogGroup(scope: Construct, id: string, functionName: string, key: kms.IKey): logs.LogGroup {
  return new logs.LogGroup(scope, id, {
    logGroupName: `/aws/lambda/${functionName}`,
    encryptionKey: key,
    retention: logs.RetentionDays.ONE_WEEK,
    removalPolicy: RemovalPolicy.DESTROY,
  });
}

function nodeFunction(
  scope: Construct,
  id: string,
  functionName: string,
  entry: string,
  logKey: kms.IKey,
  environment: Record<string, string>,
  reservedConcurrentExecutions: number,
  timeout = Duration.seconds(15),
): lambdaNode.NodejsFunction {
  return new lambdaNode.NodejsFunction(scope, id, {
    functionName,
    entry: path.join(repositoryRoot, entry),
    handler: 'handler',
    runtime: lambda.Runtime.NODEJS_22_X,
    architecture: lambda.Architecture.ARM_64,
    memorySize: 512,
    timeout,
    reservedConcurrentExecutions,
    environment,
    logGroup: functionLogGroup(scope, `${id}Logs`, functionName, logKey),
    tracing: lambda.Tracing.ACTIVE,
    bundling: {
      minify: true,
      sourceMap: true,
      target: 'node22',
    },
  });
}

export function createApplicationResources(scope: Construct, props: ApplicationStackProps) {
  const stack = Stack.of(scope);
  const logKey = new kms.Key(scope, 'LogEncryptionKey', {
    alias: 'alias/generative-ai-chat-logs',
    description: 'Encrypts short-lived application and audit logs.',
    enableKeyRotation: true,
    removalPolicy: RemovalPolicy.DESTROY,
    pendingWindow: Duration.days(7),
  });
  logKey.addToResourcePolicy(new iam.PolicyStatement({
    principals: [new iam.ServicePrincipal(`logs.${stack.region}.amazonaws.com`)],
    actions: ['kms:Encrypt', 'kms:Decrypt', 'kms:ReEncrypt*', 'kms:GenerateDataKey*', 'kms:DescribeKey'],
    resources: ['*'],
    conditions: {
      ArnLike: { 'kms:EncryptionContext:aws:logs:arn': `arn:${stack.partition}:logs:${stack.region}:${stack.account}:log-group:*` },
    },
  }));

  const configTable = new dynamodb.Table(scope, 'ConfigTable', {
    partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
    billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    encryption: dynamodb.TableEncryption.AWS_MANAGED,
    pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: false },
    removalPolicy: RemovalPolicy.DESTROY,
  });

  const guardrail = new bedrock.CfnGuardrail(scope, 'ChatGuardrail', {
    name: 'generative-ai-chat-guardrail',
    description: 'Baseline safeguards for the training chat application.',
    blockedInputMessaging: 'この内容には回答できません。別の質問をお試しください。',
    blockedOutputsMessaging: '安全上の理由により、この回答は表示できません。',
    contentPolicyConfig: {
      filtersConfig: [
        { type: 'HATE', inputStrength: 'HIGH', outputStrength: 'HIGH' },
        { type: 'INSULTS', inputStrength: 'MEDIUM', outputStrength: 'MEDIUM' },
        { type: 'SEXUAL', inputStrength: 'HIGH', outputStrength: 'HIGH' },
        { type: 'VIOLENCE', inputStrength: 'HIGH', outputStrength: 'HIGH' },
        { type: 'MISCONDUCT', inputStrength: 'HIGH', outputStrength: 'HIGH' },
        { type: 'PROMPT_ATTACK', inputStrength: 'HIGH', outputStrength: 'NONE' },
      ],
    },
    sensitiveInformationPolicyConfig: {
      piiEntitiesConfig: [
        { type: 'AWS_ACCESS_KEY', action: 'BLOCK' },
        { type: 'AWS_SECRET_KEY', action: 'BLOCK' },
        { type: 'PASSWORD', action: 'BLOCK' },
      ],
    },
  });

  const memory = new agentcore.CfnMemory(scope, 'ShortTermMemory', {
    name: 'GenerativeAIChatMemory',
    description: 'Session-scoped short-term chat checkpoints.',
    eventExpiryDuration: 3,
    tags: { Application: 'GenerativeAIChat', DataClass: 'TrainingConversation' },
  });
  memory.applyRemovalPolicy(RemovalPolicy.DESTROY);

  const runtimeRole = new iam.Role(scope, 'AgentRuntimeRole', {
    assumedBy: new iam.ServicePrincipal('bedrock-agentcore.amazonaws.com'),
    description: 'Least-privilege execution role for the training chat agent.',
  });
  runtimeRole.addToPolicy(new iam.PolicyStatement({
    actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream', 'bedrock:ApplyGuardrail'],
    resources: [
      `arn:${stack.partition}:bedrock:*:${stack.account}:inference-profile/global.anthropic.claude-sonnet-5`,
      `arn:${stack.partition}:bedrock:*:${stack.account}:inference-profile/jp.amazon.nova-2-lite-v1:0`,
      `arn:${stack.partition}:bedrock:*:${stack.account}:inference-profile/apac.amazon.nova-pro-v1:0`,
      `arn:${stack.partition}:bedrock:*::foundation-model/anthropic.claude-sonnet-5*`,
      `arn:${stack.partition}:bedrock:*::foundation-model/amazon.nova-2-lite*`,
      `arn:${stack.partition}:bedrock:*::foundation-model/amazon.nova-pro*`,
      guardrail.attrGuardrailArn,
    ],
  }));
  runtimeRole.addToPolicy(new iam.PolicyStatement({
    actions: ['bedrock-agentcore:CreateEvent', 'bedrock-agentcore:ListEvents', 'bedrock-agentcore:GetEvent'],
    resources: [memory.attrMemoryArn],
  }));
  runtimeRole.addToPolicy(new iam.PolicyStatement({
    actions: ['xray:PutTraceSegments', 'xray:PutTelemetryRecords', 'xray:GetSamplingRules', 'xray:GetSamplingTargets'],
    resources: ['*'],
  }));
  runtimeRole.addToPolicy(new iam.PolicyStatement({
    actions: ['cloudwatch:PutMetricData'],
    resources: ['*'],
    conditions: { StringEquals: { 'cloudwatch:namespace': 'bedrock-agentcore' } },
  }));
  const runtimeLogGroupArn = `arn:${stack.partition}:logs:${stack.region}:${stack.account}:log-group:/aws/bedrock-agentcore/runtimes/*`;
  runtimeRole.addToPolicy(new iam.PolicyStatement({
    actions: ['logs:DescribeLogStreams', 'logs:CreateLogGroup'],
    resources: [runtimeLogGroupArn],
  }));
  runtimeRole.addToPolicy(new iam.PolicyStatement({
    actions: ['logs:DescribeLogGroups'],
    resources: [`arn:${stack.partition}:logs:${stack.region}:${stack.account}:log-group:*`],
  }));
  runtimeRole.addToPolicy(new iam.PolicyStatement({
    actions: ['logs:CreateLogStream', 'logs:PutLogEvents'],
    resources: [`${runtimeLogGroupArn}:log-stream:*`],
  }));

  const agentArtifact = agentcore.AgentRuntimeArtifact.fromCodeAsset({
    path: path.join(repositoryRoot, 'agent/dist/agent.zip'),
    runtime: agentcore.AgentCoreRuntime.PYTHON_3_12,
    entrypoint: ['main.py'],
  });
  const runtime = new agentcore.Runtime(scope, 'ChatAgentRuntime', {
    runtimeName: 'GenerativeAIChatAgent',
    description: 'LangGraph chat agent for interactive AWS training.',
    agentRuntimeArtifact: agentArtifact,
    executionRole: runtimeRole,
    networkConfiguration: agentcore.RuntimeNetworkConfiguration.usingPublicNetwork(),
    protocolConfiguration: agentcore.ProtocolType.HTTP,
    authorizerConfiguration: agentcore.RuntimeAuthorizerConfiguration.usingCognito(
      props.userPool,
      [props.userPoolClient],
      undefined,
      undefined,
      [agentcore.RuntimeCustomClaim.withStringValue('token_use', 'access')],
    ),
    environmentVariables: {
      MEMORY_ID: memory.attrMemoryId,
      GUARDRAIL_ID: guardrail.attrGuardrailId,
      GUARDRAIL_VERSION: 'DRAFT',
    },
    lifecycleConfiguration: {
      idleRuntimeSessionTimeout: Duration.minutes(15),
      maxLifetime: Duration.hours(2),
    },
    tracingEnabled: true,
  });
  runtime.node.addDependency(memory, guardrail);
  runtime.addEndpoint('LiveEndpoint', {
    version: runtime.agentRuntimeVersion ?? '1',
    description: 'Live training endpoint.',
  });

  const runtimeLogs = new logs.LogGroup(scope, 'AgentRuntimeLogs', {
    logGroupName: `/aws/bedrock-agentcore/runtimes/${runtime.agentRuntimeId}-DEFAULT`,
    encryptionKey: logKey,
    retention: logs.RetentionDays.ONE_WEEK,
    removalPolicy: RemovalPolicy.DESTROY,
  });
  runtimeLogs.node.addDependency(runtime);

  const commonEnvironment = { CONFIG_TABLE_NAME: configTable.tableName };
  const authorizerFunction = nodeFunction(
    scope,
    'AuthorizerFunction',
    'generative-ai-chat-authorizer',
    'amplify/functions/authorizer/handler.ts',
    logKey,
    { USER_POOL_ID: props.userPool.userPoolId, USER_POOL_CLIENT_ID: props.userPoolClient.userPoolClientId },
    20,
    Duration.seconds(10),
  );
  const configFunction = nodeFunction(
    scope,
    'ConfigFunction',
    'generative-ai-chat-config',
    'amplify/functions/config/handler.ts',
    logKey,
    commonEnvironment,
    10,
  );
  const chatFunction = nodeFunction(
    scope,
    'ChatFunction',
    'generative-ai-chat-stream',
    'amplify/functions/chat/handler.ts',
    logKey,
    {
      ...commonEnvironment,
      AGENT_RUNTIME_ARN: runtime.agentRuntimeArn,
      AGENT_RUNTIME_QUALIFIER: 'LiveEndpoint',
    },
    35,
    Duration.seconds(90),
  );
  configTable.grantReadWriteData(configFunction);
  configTable.grantReadData(chatFunction);

  const accessLogs = new logs.LogGroup(scope, 'ApiAccessLogs', {
    encryptionKey: logKey,
    retention: logs.RetentionDays.ONE_WEEK,
    removalPolicy: RemovalPolicy.DESTROY,
  });
  const api = new apigateway.RestApi(scope, 'ChatApi', {
    restApiName: 'generative-ai-chat-api',
    description: 'Authenticated API for the Generative AI Chat training application.',
    endpointTypes: [apigateway.EndpointType.REGIONAL],
    cloudWatchRole: false,
    deployOptions: {
      stageName: 'prod',
      accessLogDestination: new apigateway.LogGroupLogDestination(accessLogs),
      accessLogFormat: apigateway.AccessLogFormat.jsonWithStandardFields({
        caller: false,
        httpMethod: true,
        ip: true,
        protocol: true,
        requestTime: true,
        resourcePath: true,
        responseLength: true,
        status: true,
        user: false,
      }),
      metricsEnabled: true,
      tracingEnabled: true,
      throttlingBurstLimit: 30,
      throttlingRateLimit: 60,
    },
  });
  const authorizer = new apigateway.TokenAuthorizer(scope, 'AccessTokenAuthorizer', {
    handler: authorizerFunction,
    identitySource: apigateway.IdentitySource.header('Authorization'),
    resultsCacheTtl: Duration.seconds(0),
    validationRegex: '^Bearer\\s+[-A-Za-z0-9._~+/]+=*$',
  });
  const securedMethodOptions: apigateway.MethodOptions = {
    authorizationType: apigateway.AuthorizationType.CUSTOM,
    authorizer,
  };
  const bufferedConfigIntegration = new apigateway.LambdaIntegration(configFunction, {
    proxy: true,
    timeout: Duration.seconds(15),
  });
  const streamingChatIntegration = new apigateway.LambdaIntegration(chatFunction, {
    proxy: true,
    timeout: Duration.seconds(90),
    responseTransferMode: apigateway.ResponseTransferMode.STREAM,
  });
  const optionsIntegration = new apigateway.LambdaIntegration(configFunction, { proxy: true });

  const configResource = api.root.addResource('config');
  configResource.addMethod('GET', bufferedConfigIntegration, securedMethodOptions);
  configResource.addMethod('OPTIONS', optionsIntegration);
  const adminConfigResource = api.root.addResource('admin').addResource('config');
  adminConfigResource.addMethod('GET', bufferedConfigIntegration, securedMethodOptions);
  adminConfigResource.addMethod('PUT', bufferedConfigIntegration, securedMethodOptions);
  adminConfigResource.addMethod('OPTIONS', optionsIntegration);
  const chatResource = api.root.addResource('chat');
  chatResource.addMethod('POST', streamingChatIntegration, securedMethodOptions);
  chatResource.addMethod('OPTIONS', optionsIntegration);

  const healthIntegration = new apigateway.MockIntegration({
    integrationResponses: [{ statusCode: '200', responseTemplates: { 'application/json': '{"status":"ok"}' } }],
    passthroughBehavior: apigateway.PassthroughBehavior.NEVER,
    requestTemplates: { 'application/json': '{"statusCode": 200}' },
  });
  api.root.addResource('health').addMethod('GET', healthIntegration, {
    methodResponses: [{ statusCode: '200', responseModels: { 'application/json': apigateway.Model.EMPTY_MODEL } }],
  });

  return {
    apiUrl: api.url,
    userPoolId: props.userPool.userPoolId,
    userPoolClientId: props.userPoolClient.userPoolClientId,
    runtimeArn: runtime.agentRuntimeArn,
    memoryId: memory.attrMemoryId,
  };
}
