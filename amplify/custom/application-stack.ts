import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ArnFormat,
  CustomResource,
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
  aws_s3 as s3,
  aws_s3_deployment as s3deploy,
  aws_s3vectors as s3vectors,
} from 'aws-cdk-lib';
import * as customResources from 'aws-cdk-lib/custom-resources';
import type { Construct } from 'constructs';
import {
  AGENTCORE_APPLICATION_LOG_FIELDS,
  addAgentCoreApplicationLogDelivery,
  addAgentCoreTraceDelivery,
} from './agentcore-observability.js';
import {
  GUARDRAIL_POLICY_KEYS,
  effectiveGuardrailKey,
  type GuardrailPolicyKey,
} from '../../shared/guardrail-catalog.js';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(currentDirectory, '../..');
const RAG_DOCUMENT_VERSION = 1;
const WEB_SEARCH_REGION = 'us-east-1';

interface ApplicationStackProps {
  userPool: cognito.IUserPool;
  userPoolClient: cognito.IUserPoolClient;
}

interface GuardrailDeployment {
  guardrailId: string;
  guardrailVersion: string;
}

interface DeployedGuardrails {
  catalog: Record<string, GuardrailDeployment>;
  guardrails: bedrock.CfnGuardrail[];
  guardrailArns: string[];
  profileArns: string[];
}

const GUARDRAIL_DEFINITION_VERSION = 2;
const GUARDRAIL_NAME_CODES: Record<GuardrailPolicyKey, string> = {
  'content-safety': 'content',
  'prompt-attack': 'attack',
  'sensitive-information': 'pii',
  'denied-topic-travel': 'travel',
  'blocked-word-pineapple': 'pineapple',
};

function guardrailPolicyProperties(
  policies: GuardrailPolicyKey[],
): Pick<bedrock.CfnGuardrailProps,
  'contentPolicyConfig' | 'sensitiveInformationPolicyConfig' | 'topicPolicyConfig' | 'wordPolicyConfig'> {
  const contentFilters: bedrock.CfnGuardrail.ContentFilterConfigProperty[] = [];
  if (policies.includes('content-safety')) {
    contentFilters.push(...['HATE', 'INSULTS', 'SEXUAL', 'VIOLENCE', 'MISCONDUCT'].map((type) => ({
      type,
      inputStrength: 'MEDIUM',
      outputStrength: 'MEDIUM',
      inputAction: 'BLOCK',
      outputAction: 'BLOCK',
      inputEnabled: true,
      outputEnabled: true,
    })));
  }
  if (policies.includes('prompt-attack')) {
    contentFilters.push({
      type: 'PROMPT_ATTACK',
      inputStrength: 'HIGH',
      outputStrength: 'NONE',
      inputAction: 'BLOCK',
      outputAction: 'NONE',
      inputEnabled: true,
      outputEnabled: false,
    });
  }

  return {
    contentPolicyConfig: contentFilters.length > 0 ? {
      filtersConfig: contentFilters,
      contentFiltersTierConfig: { tierName: 'STANDARD' },
    } : undefined,
    sensitiveInformationPolicyConfig: policies.includes('sensitive-information') ? {
      piiEntitiesConfig: ['EMAIL', 'PHONE'].map((type) => ({
        type,
        action: 'ANONYMIZE',
        inputAction: 'ANONYMIZE',
        outputAction: 'ANONYMIZE',
        inputEnabled: true,
        outputEnabled: true,
      })),
    } : undefined,
    topicPolicyConfig: policies.includes('denied-topic-travel') ? {
      topicsConfig: [{
        name: 'Travel',
        definition: '旅行、観光地、宿泊施設、旅程、移動手段、旅行先の推薦に関する話題',
        examples: [
          '東京旅行のおすすめを教えて',
          '京都の観光地を紹介して',
          '週末の旅行プランを作って',
        ],
        type: 'DENY',
        inputAction: 'BLOCK',
        outputAction: 'BLOCK',
        inputEnabled: true,
        outputEnabled: true,
      }],
      topicsTierConfig: { tierName: 'STANDARD' },
    } : undefined,
    wordPolicyConfig: policies.includes('blocked-word-pineapple') ? {
      wordsConfig: [{
        text: 'pineapple',
        inputAction: 'BLOCK',
        outputAction: 'BLOCK',
        inputEnabled: true,
        outputEnabled: true,
      }],
    } : undefined,
  };
}

function createGuardrailCatalog(scope: Construct): DeployedGuardrails {
  const stack = Stack.of(scope);
  const profileArn = stack.formatArn({
    service: 'bedrock',
    resource: 'guardrail-profile',
    resourceName: 'apac.guardrail.v1:0',
    arnFormat: ArnFormat.SLASH_RESOURCE_NAME,
  });
  const apacDestinationRegions = [
    'ap-south-1',
    'ap-northeast-3',
    'ap-northeast-2',
    'ap-southeast-1',
    'ap-southeast-2',
    'ap-northeast-1',
  ];
  const profileArns = apacDestinationRegions.map((region) =>
    `arn:${stack.partition}:bedrock:${region}:${stack.account}:guardrail-profile/apac.guardrail.v1:0`);
  const combinations = Array.from(
    { length: (2 ** GUARDRAIL_POLICY_KEYS.length) - 1 },
    (_, maskIndex) => GUARDRAIL_POLICY_KEYS.filter((_, keyIndex) => ((maskIndex + 1) & (1 << keyIndex)) !== 0),
  );

  const catalog: Record<string, GuardrailDeployment> = {};
  const guardrails: bedrock.CfnGuardrail[] = [];
  for (const policies of combinations) {
    const suffix = policies.map((key) => GUARDRAIL_NAME_CODES[key]).join('-');
    const constructSuffix = policies.map((key) => GUARDRAIL_NAME_CODES[key][0].toUpperCase()
      + GUARDRAIL_NAME_CODES[key].slice(1)).join('');
    const guardrail = new bedrock.CfnGuardrail(scope, `ChatGuardrail${constructSuffix}`, {
      name: `genai-chat-gr-${suffix}`,
      description: `Training guardrail preset: ${policies.join(', ')}`,
      blockedInputMessaging: '選択したGuardrailにより入力がブロックされました。',
      blockedOutputsMessaging: '選択したGuardrailにより回答がブロックされました。',
      crossRegionConfig: { guardrailProfileArn: profileArn },
      ...guardrailPolicyProperties(policies),
    });
    guardrail.applyRemovalPolicy(RemovalPolicy.DESTROY);
    const version = new bedrock.CfnGuardrailVersion(
      scope,
      `ChatGuardrail${constructSuffix}VersionV${GUARDRAIL_DEFINITION_VERSION}`,
      {
        guardrailIdentifier: guardrail.attrGuardrailId,
        description: `Immutable training definition v${GUARDRAIL_DEFINITION_VERSION}`,
      },
    );
    version.addResourceDependency(guardrail);
    const key = effectiveGuardrailKey([], policies);
    catalog[key] = {
      guardrailId: guardrail.attrGuardrailId,
      guardrailVersion: version.attrVersion,
    };
    guardrails.push(guardrail);
  }
  return { catalog, guardrails, guardrailArns: guardrails.map((guardrail) => guardrail.attrGuardrailArn), profileArns };
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

function manageAgentRuntimeLogGroup(
  scope: Construct,
  id: string,
  logGroupName: string,
  logKey: kms.IKey,
  runtime: agentcore.Runtime,
): { logGroup: logs.ILogGroup; ready: Construct } {
  const retention = new logs.LogRetention(scope, `${id}Retention`, {
    logGroupName,
    retention: logs.RetentionDays.ONE_WEEK,
    removalPolicy: RemovalPolicy.DESTROY,
    logRetentionRetryOptions: { maxRetries: 12 },
  });
  retention.node.addDependency(runtime);

  const logGroupArn = Stack.of(scope).formatArn({
    service: 'logs',
    resource: 'log-group',
    resourceName: `${logGroupName}:*`,
    arnFormat: ArnFormat.COLON_RESOURCE_NAME,
  });
  const encryption = new customResources.AwsCustomResource(scope, `${id}Encryption`, {
    onCreate: {
      service: 'CloudWatchLogs',
      action: 'associateKmsKey',
      parameters: { logGroupName, kmsKeyId: logKey.keyArn },
      physicalResourceId: customResources.PhysicalResourceId.of(logGroupName),
    },
    onUpdate: {
      service: 'CloudWatchLogs',
      action: 'associateKmsKey',
      parameters: { logGroupName, kmsKeyId: logKey.keyArn },
      physicalResourceId: customResources.PhysicalResourceId.of(logGroupName),
    },
    onDelete: {
      service: 'CloudWatchLogs',
      action: 'disassociateKmsKey',
      parameters: { logGroupName },
      ignoreErrorCodesMatching: 'ResourceNotFoundException',
    },
    policy: customResources.AwsCustomResourcePolicy.fromStatements([
      new iam.PolicyStatement({
        actions: ['logs:AssociateKmsKey', 'logs:DisassociateKmsKey'],
        resources: [logGroupArn],
      }),
      new iam.PolicyStatement({
        actions: ['kms:DescribeKey'],
        resources: [logKey.keyArn],
      }),
    ]),
    installLatestAwsSdk: false,
  });
  encryption.node.addDependency(retention);
  return {
    logGroup: logs.LogGroup.fromLogGroupName(scope, `${id}Reference`, logGroupName),
    ready: encryption,
  };
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

  const knowledgeSourceBucket = new s3.Bucket(scope, 'KnowledgeSourceBucket', {
    blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    encryption: s3.BucketEncryption.S3_MANAGED,
    enforceSSL: true,
    autoDeleteObjects: true,
    removalPolicy: RemovalPolicy.DESTROY,
  });
  const knowledgeDocuments = new s3deploy.BucketDeployment(scope, 'KnowledgeDocuments', {
    sources: [s3deploy.Source.asset(path.join(repositoryRoot, 'knowledge-base'), { exclude: ['README.md'] })],
    destinationBucket: knowledgeSourceBucket,
    destinationKeyPrefix: 'policies',
    prune: true,
    retainOnDelete: false,
  });

  const vectorBucket = new s3vectors.CfnVectorBucket(scope, 'KnowledgeVectorBucket', {
    encryptionConfiguration: { sseType: 'AES256' },
    tags: [{ key: 'Application', value: 'GenerativeAIChat' }],
  });
  vectorBucket.applyRemovalPolicy(RemovalPolicy.DESTROY);
  const vectorIndex = new s3vectors.CfnIndex(scope, 'KnowledgeVectorIndex', {
    vectorBucketArn: vectorBucket.attrVectorBucketArn,
    indexName: 'company-policies',
    dataType: 'float32',
    dimension: 1_024,
    distanceMetric: 'cosine',
    metadataConfiguration: {
      nonFilterableMetadataKeys: ['AMAZON_BEDROCK_TEXT', 'AMAZON_BEDROCK_METADATA'],
    },
    tags: [{ key: 'Application', value: 'GenerativeAIChat' }],
  });
  vectorIndex.applyRemovalPolicy(RemovalPolicy.DESTROY);
  vectorIndex.addResourceDependency(vectorBucket);

  const knowledgeRole = new iam.Role(scope, 'KnowledgeBaseRole', {
    assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com', {
      conditions: {
        StringEquals: { 'aws:SourceAccount': stack.account },
        ArnLike: { 'aws:SourceArn': `arn:${stack.partition}:bedrock:${stack.region}:${stack.account}:knowledge-base/*` },
      },
    }),
    description: 'Reads fictional policy documents and writes their embeddings to S3 Vectors.',
  });
  const knowledgePolicy = new iam.Policy(scope, 'KnowledgeBasePolicy', {
    statements: [
      new iam.PolicyStatement({
        actions: ['bedrock:InvokeModel'],
        resources: [`arn:${stack.partition}:bedrock:${stack.region}::foundation-model/amazon.titan-embed-text-v2:0`],
      }),
      new iam.PolicyStatement({
        actions: ['s3:ListBucket'],
        resources: [knowledgeSourceBucket.bucketArn],
      }),
      new iam.PolicyStatement({
        actions: ['s3:GetObject'],
        resources: [knowledgeSourceBucket.arnForObjects('policies/*')],
      }),
      new iam.PolicyStatement({
        actions: [
          's3vectors:PutVectors',
          's3vectors:GetVectors',
          's3vectors:DeleteVectors',
          's3vectors:QueryVectors',
          's3vectors:GetIndex',
        ],
        resources: [vectorIndex.attrIndexArn],
      }),
    ],
  });
  knowledgeRole.attachInlinePolicy(knowledgePolicy);

  const knowledgeBase = new bedrock.CfnKnowledgeBase(scope, 'CompanyPolicyKnowledgeBase', {
    name: 'GenerativeAIChatCompanyPolicies',
    description: 'Fictional Japanese company policies for the RAG training demo.',
    roleArn: knowledgeRole.roleArn,
    knowledgeBaseConfiguration: {
      type: 'VECTOR',
      vectorKnowledgeBaseConfiguration: {
        embeddingModelArn: `arn:${stack.partition}:bedrock:${stack.region}::foundation-model/amazon.titan-embed-text-v2:0`,
        embeddingModelConfiguration: {
          bedrockEmbeddingModelConfiguration: { dimensions: 1_024, embeddingDataType: 'FLOAT32' },
        },
      },
    },
    storageConfiguration: {
      type: 'S3_VECTORS',
      s3VectorsConfiguration: {
        vectorBucketArn: vectorBucket.attrVectorBucketArn,
        indexArn: vectorIndex.attrIndexArn,
      },
    },
    tags: { Application: 'GenerativeAIChat', DataClass: 'FictionalTrainingMaterial' },
  });
  knowledgeBase.applyRemovalPolicy(RemovalPolicy.DESTROY);
  knowledgeBase.node.addDependency(knowledgePolicy, vectorIndex);

  const knowledgeDataSource = new bedrock.CfnDataSource(scope, 'CompanyPolicyDataSource', {
    name: 'FictionalCompanyPolicies',
    description: 'Japanese fictional policies deployed with the public sample application.',
    knowledgeBaseId: knowledgeBase.attrKnowledgeBaseId,
    dataDeletionPolicy: 'DELETE',
    dataSourceConfiguration: {
      type: 'S3',
      s3Configuration: {
        bucketArn: knowledgeSourceBucket.bucketArn,
        bucketOwnerAccountId: stack.account,
        inclusionPrefixes: ['policies/'],
      },
    },
    vectorIngestionConfiguration: {
      chunkingConfiguration: {
        chunkingStrategy: 'FIXED_SIZE',
        fixedSizeChunkingConfiguration: { maxTokens: 300, overlapPercentage: 20 },
      },
    },
  });
  knowledgeDataSource.applyRemovalPolicy(RemovalPolicy.DESTROY);
  knowledgeDataSource.node.addDependency(knowledgeBase);

  const ingestion = new customResources.AwsCustomResource(scope, 'KnowledgeBaseIngestion', {
    onCreate: {
      service: 'BedrockAgent',
      action: 'startIngestionJob',
      parameters: {
        knowledgeBaseId: knowledgeBase.attrKnowledgeBaseId,
        dataSourceId: knowledgeDataSource.attrDataSourceId,
        description: `Deployment sync v${RAG_DOCUMENT_VERSION}`,
      },
      physicalResourceId: customResources.PhysicalResourceId.fromResponse('ingestionJob.ingestionJobId'),
    },
    onUpdate: {
      service: 'BedrockAgent',
      action: 'startIngestionJob',
      parameters: {
        knowledgeBaseId: knowledgeBase.attrKnowledgeBaseId,
        dataSourceId: knowledgeDataSource.attrDataSourceId,
        description: `Deployment sync v${RAG_DOCUMENT_VERSION}`,
      },
      physicalResourceId: customResources.PhysicalResourceId.fromResponse('ingestionJob.ingestionJobId'),
    },
    policy: customResources.AwsCustomResourcePolicy.fromStatements([new iam.PolicyStatement({
      actions: ['bedrock:StartIngestionJob'],
      resources: ['*'],
    })]),
    installLatestAwsSdk: false,
    timeout: Duration.minutes(2),
  });
  ingestion.node.addDependency(knowledgeDocuments, knowledgeDataSource);

  const gatewayRole = new iam.Role(scope, 'WebSearchGatewayRole', {
    assumedBy: new iam.ServicePrincipal('bedrock-agentcore.amazonaws.com', {
      conditions: {
        StringEquals: { 'aws:SourceAccount': stack.account },
        ArnLike: { 'aws:SourceArn': `arn:${stack.partition}:bedrock-agentcore:${WEB_SEARCH_REGION}:${stack.account}:*` },
      },
    }),
    description: 'Invokes the managed AgentCore Web Search connector.',
  });
  const gatewayExecutionPolicy = new iam.Policy(scope, 'WebSearchGatewayExecutionPolicy', {
    statements: [
      new iam.PolicyStatement({
        actions: ['bedrock-agentcore:InvokeGateway'],
        resources: [`arn:${stack.partition}:bedrock-agentcore:${WEB_SEARCH_REGION}:${stack.account}:gateway/*`],
      }),
      new iam.PolicyStatement({
        actions: ['bedrock-agentcore:InvokeWebSearch'],
        resources: [`arn:${stack.partition}:bedrock-agentcore:${WEB_SEARCH_REGION}:aws:tool/web-search.v1`],
      }),
    ],
  });
  gatewayExecutionPolicy.attachToRole(gatewayRole);

  const gatewayProviderEnvironment = { TARGET_REGION: WEB_SEARCH_REGION };
  const gatewayOnEvent = new lambdaNode.NodejsFunction(scope, 'WebSearchGatewayOnEvent', {
    functionName: 'generative-ai-chat-web-search-provider',
    entry: path.join(repositoryRoot, 'amplify/functions/gateway-provider/handler.ts'),
    handler: 'onEvent',
    runtime: lambda.Runtime.NODEJS_22_X,
    architecture: lambda.Architecture.ARM_64,
    memorySize: 256,
    timeout: Duration.seconds(60),
    environment: gatewayProviderEnvironment,
    logGroup: functionLogGroup(scope, 'WebSearchGatewayOnEventLogs', 'generative-ai-chat-web-search-provider', logKey),
    bundling: { minify: true, sourceMap: true, target: 'node22', bundleAwsSDK: true },
  });
  const gatewayIsComplete = new lambdaNode.NodejsFunction(scope, 'WebSearchGatewayIsComplete', {
    functionName: 'generative-ai-chat-web-search-provider-check',
    entry: path.join(repositoryRoot, 'amplify/functions/gateway-provider/handler.ts'),
    handler: 'isComplete',
    runtime: lambda.Runtime.NODEJS_22_X,
    architecture: lambda.Architecture.ARM_64,
    memorySize: 256,
    timeout: Duration.seconds(60),
    environment: gatewayProviderEnvironment,
    logGroup: functionLogGroup(scope, 'WebSearchGatewayIsCompleteLogs', 'generative-ai-chat-web-search-provider-check', logKey),
    bundling: { minify: true, sourceMap: true, target: 'node22', bundleAwsSDK: true },
  });
  for (const providerFunction of [gatewayOnEvent, gatewayIsComplete]) {
    providerFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'bedrock-agentcore:CreateGateway',
        'bedrock-agentcore:GetGateway',
        'bedrock-agentcore:ListGateways',
        'bedrock-agentcore:DeleteGateway',
        'bedrock-agentcore:CreateGatewayTarget',
        'bedrock-agentcore:GetGatewayTarget',
        'bedrock-agentcore:ListGatewayTargets',
        'bedrock-agentcore:DeleteGatewayTarget',
      ],
      resources: ['*'],
    }));
    providerFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: ['bedrock-agentcore:CreateWorkloadIdentity'],
      resources: [
        `arn:${stack.partition}:bedrock-agentcore:${WEB_SEARCH_REGION}:${stack.account}:workload-identity-directory/default`,
        `arn:${stack.partition}:bedrock-agentcore:${WEB_SEARCH_REGION}:${stack.account}:workload-identity-directory/default/workload-identity/*`,
      ],
    }));
    providerFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: ['bedrock-agentcore:ListWorkloadIdentities'],
      resources: [
        `arn:${stack.partition}:bedrock-agentcore:${WEB_SEARCH_REGION}:${stack.account}:workload-identity-directory/default`,
      ],
    }));
    providerFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'bedrock-agentcore:GetWorkloadIdentity',
        'bedrock-agentcore:DeleteWorkloadIdentity',
      ],
      resources: [
        `arn:${stack.partition}:bedrock-agentcore:${WEB_SEARCH_REGION}:${stack.account}:workload-identity-directory/default/workload-identity/*`,
      ],
    }));
    providerFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'bedrock-agentcore:TagResource',
        'bedrock-agentcore:UntagResource',
        'bedrock-agentcore:ListTagsForResource',
      ],
      resources: [
        `arn:${stack.partition}:bedrock-agentcore:${WEB_SEARCH_REGION}:${stack.account}:gateway/*`,
        `arn:${stack.partition}:bedrock-agentcore:${WEB_SEARCH_REGION}:${stack.account}:workload-identity-directory/default/workload-identity/*`,
      ],
    }));
    providerFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: ['iam:PassRole'],
      resources: [gatewayRole.roleArn],
      conditions: { StringEquals: { 'iam:PassedToService': 'bedrock-agentcore.amazonaws.com' } },
    }));
  }
  const gatewayProviderFrameworkLogs = new logs.LogGroup(scope, 'WebSearchGatewayProviderFrameworkLogs', {
    encryptionKey: logKey,
    retention: logs.RetentionDays.ONE_WEEK,
    removalPolicy: RemovalPolicy.DESTROY,
  });
  const gatewayProvider = new customResources.Provider(scope, 'WebSearchGatewayProvider', {
    onEventHandler: gatewayOnEvent,
    isCompleteHandler: gatewayIsComplete,
    queryInterval: Duration.seconds(5),
    totalTimeout: Duration.minutes(10),
    logGroup: gatewayProviderFrameworkLogs,
  });
  const webSearchGateway = new CustomResource(scope, 'WebSearchGateway', {
    serviceToken: gatewayProvider.serviceToken,
    properties: {
      GatewayName: 'generative-ai-chat-web-search',
      GatewayRoleArn: gatewayRole.roleArn,
    },
  });
  webSearchGateway.node.addDependency(gatewayExecutionPolicy);
  const webSearchGatewayUrl = webSearchGateway.getAttString('GatewayUrl');

  const deployedGuardrails = createGuardrailCatalog(scope);

  const memory = new agentcore.CfnMemory(scope, 'ShortTermMemory', {
    name: 'GenerativeAIChatMemory',
    description: 'Session-scoped short-term chat checkpoints.',
    eventExpiryDuration: 3,
    tags: { Application: 'GenerativeAIChat', DataClass: 'TrainingConversation' },
  });
  memory.applyRemovalPolicy(RemovalPolicy.DESTROY);
  const memoryLogGroup = new logs.LogGroup(scope, 'ShortTermMemoryApplicationLogs', {
    logGroupName: `/aws/vendedlogs/bedrock-agentcore/memory/APPLICATION_LOGS/${memory.attrMemoryId}`,
    retention: logs.RetentionDays.ONE_WEEK,
    removalPolicy: RemovalPolicy.DESTROY,
  });
  memoryLogGroup.node.addDependency(memory);
  addAgentCoreApplicationLogDelivery(scope, 'ShortTermMemoryApplicationLogs', {
    resourceArn: memory.attrMemoryArn,
    logGroup: memoryLogGroup,
  });
  addAgentCoreTraceDelivery(scope, 'ShortTermMemoryTraces', memory.attrMemoryArn);

  const runtimeRole = new iam.Role(scope, 'AgentRuntimeRole', {
    assumedBy: new iam.ServicePrincipal('bedrock-agentcore.amazonaws.com'),
    description: 'Least-privilege execution role for the training chat agent.',
  });
  runtimeRole.addToPolicy(new iam.PolicyStatement({
    actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
    resources: [
      `arn:${stack.partition}:bedrock:*:${stack.account}:inference-profile/global.anthropic.claude-sonnet-5`,
      `arn:${stack.partition}:bedrock:*:${stack.account}:inference-profile/jp.amazon.nova-2-lite-v1:0`,
      `arn:${stack.partition}:bedrock:*:${stack.account}:inference-profile/apac.amazon.nova-micro-v1:0`,
      `arn:${stack.partition}:bedrock:*:${stack.account}:inference-profile/apac.amazon.nova-pro-v1:0`,
      `arn:${stack.partition}:bedrock:*::foundation-model/anthropic.claude-sonnet-5*`,
      `arn:${stack.partition}:bedrock:*::foundation-model/amazon.nova-2-lite*`,
      `arn:${stack.partition}:bedrock:*::foundation-model/amazon.nova-micro*`,
      `arn:${stack.partition}:bedrock:*::foundation-model/amazon.nova-pro*`,
    ],
  }));
  runtimeRole.addToPolicy(new iam.PolicyStatement({
    actions: ['bedrock:Retrieve'],
    resources: [`arn:${stack.partition}:bedrock:${stack.region}:${stack.account}:knowledge-base/${knowledgeBase.attrKnowledgeBaseId}`],
  }));
  runtimeRole.addToPolicy(new iam.PolicyStatement({
    actions: ['bedrock-agentcore:InvokeGateway'],
    resources: [`arn:${stack.partition}:bedrock-agentcore:${WEB_SEARCH_REGION}:${stack.account}:gateway/*`],
  }));
  runtimeRole.addToPolicy(new iam.PolicyStatement({
    actions: ['bedrock:ApplyGuardrail'],
    resources: [...deployedGuardrails.guardrailArns, ...deployedGuardrails.profileArns],
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
  runtimeRole.addToPolicy(new iam.PolicyStatement({
    actions: ['logs:PutResourcePolicy'],
    resources: ['*'],
  }));

  const agentArtifact = agentcore.AgentRuntimeArtifact.fromCodeAsset({
    path: path.join(repositoryRoot, 'agent/dist/agent.zip'),
    runtime: agentcore.AgentCoreRuntime.PYTHON_3_12,
    entrypoint: ['opentelemetry-instrument', 'main.py'],
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
      KNOWLEDGE_BASE_ID: knowledgeBase.attrKnowledgeBaseId,
      WEB_SEARCH_GATEWAY_URL: webSearchGatewayUrl,
      WEB_SEARCH_GATEWAY_REGION: WEB_SEARCH_REGION,
      UNIFIED_TRACES_DESTINATION_ENABLED: 'true',
    },
    lifecycleConfiguration: {
      idleRuntimeSessionTimeout: Duration.minutes(15),
      maxLifetime: Duration.hours(2),
    },
    tracingEnabled: true,
  });
  runtime.node.addDependency(memory, knowledgeBase, webSearchGateway, ...deployedGuardrails.guardrails);
  runtime.addEndpoint('LiveEndpoint', {
    version: runtime.agentRuntimeVersion ?? '1',
    description: 'Live training endpoint.',
  });

  const runtimeLogGroupPrefix = `/aws/bedrock-agentcore/runtimes/${runtime.agentRuntimeId}`;
  manageAgentRuntimeLogGroup(scope, 'AgentRuntimeDefaultLogs', `${runtimeLogGroupPrefix}-DEFAULT`, logKey, runtime);
  const endpointLogs = manageAgentRuntimeLogGroup(
    scope,
    'AgentRuntimeEndpointLogs',
    `${runtimeLogGroupPrefix}-LiveEndpoint`,
    logKey,
    runtime,
  );
  addAgentCoreApplicationLogDelivery(scope, 'AgentRuntimeApplicationLogs', {
    resourceArn: runtime.agentRuntimeArn,
    logGroup: endpointLogs.logGroup,
    recordFields: AGENTCORE_APPLICATION_LOG_FIELDS,
    destinationReady: endpointLogs.ready,
  });

  const commonEnvironment = { CONFIG_TABLE_NAME: configTable.tableName };
  const authorizerFunction = nodeFunction(
    scope,
    'AuthorizerFunction',
    'generative-ai-chat-authorizer',
    'amplify/functions/authorizer/handler.ts',
    logKey,
    { USER_POOL_ID: props.userPool.userPoolId, USER_POOL_CLIENT_ID: props.userPoolClient.userPoolClientId },
    40,
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
      GUARDRAIL_CATALOG_JSON: stack.toJsonString(deployedGuardrails.catalog),
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
    knowledgeBaseId: knowledgeBase.attrKnowledgeBaseId,
    webSearchGatewayUrl,
  };
}
