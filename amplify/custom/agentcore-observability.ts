import {
  ArnFormat,
  Lazy,
  Names,
  Stack,
  aws_iam as iam,
  aws_logs as logs,
  aws_xray as xray,
} from 'aws-cdk-lib';
import type { Construct } from 'constructs';

export const AGENTCORE_APPLICATION_LOG_FIELDS = [
  'timestamp',
  'resource_arn',
  'event_timestamp',
  'account_id',
  'request_id',
  'session_id',
  'trace_id',
  'span_id',
  'service_name',
  'operation',
  'request_payload',
  'response_payload',
];

interface ApplicationLogDeliveryProps {
  resourceArn: string;
  logGroup: logs.ILogGroup;
  recordFields?: string[];
  destinationReady?: Construct;
}

export function addAgentCoreApplicationLogDelivery(
  scope: Construct,
  id: string,
  props: ApplicationLogDeliveryProps,
): logs.CfnDelivery {
  const stack = Stack.of(scope);
  const resourcePolicy: logs.CfnResourcePolicy = new logs.CfnResourcePolicy(scope, `${id}LogDeliveryPolicy`, {
    policyName: Lazy.string({ produce: (): string => Names.uniqueResourceName(resourcePolicy, {
      maxLength: 60,
      separator: '-',
    }) }),
    policyDocument: stack.toJsonString(new iam.PolicyDocument({
      statements: [new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        principals: [new iam.ServicePrincipal('delivery.logs.amazonaws.com')],
        actions: ['logs:CreateLogStream', 'logs:PutLogEvents'],
        resources: [`${props.logGroup.logGroupArn}:log-stream:*`],
        conditions: {
          StringEquals: { 'aws:SourceAccount': stack.account },
          ArnLike: {
            'aws:SourceArn': stack.formatArn({
              service: 'logs',
              resource: '*',
              arnFormat: ArnFormat.COLON_RESOURCE_NAME,
            }),
          },
        },
      })],
    }).toJSON()),
  });

  const source: logs.CfnDeliverySource = new logs.CfnDeliverySource(scope, `${id}Source`, {
    name: Lazy.string({ produce: (): string => Names.uniqueResourceName(source, {
      maxLength: 60,
      separator: '-',
    }) }),
    logType: 'APPLICATION_LOGS',
    resourceArn: props.resourceArn,
  });
  const destination: logs.CfnDeliveryDestination = new logs.CfnDeliveryDestination(scope, `${id}Destination`, {
    name: Lazy.string({ produce: (): string => Names.uniqueResourceName(destination, {
      maxLength: 60,
      separator: '-',
    }) }),
    deliveryDestinationType: 'CWL',
    destinationResourceArn: props.logGroup.logGroupArn,
  });
  destination.node.addDependency(resourcePolicy);
  if (props.destinationReady) destination.node.addDependency(props.destinationReady);

  const delivery = new logs.CfnDelivery(scope, `${id}Delivery`, {
    deliverySourceName: source.deliverySourceRef.deliverySourceName,
    deliveryDestinationArn: destination.attrArn,
    recordFields: props.recordFields,
  });
  delivery.node.addDependency(source, destination);
  return delivery;
}

export function addAgentCoreTraceDelivery(
  scope: Construct,
  id: string,
  resourceArn: string,
): logs.CfnDelivery {
  const stack = Stack.of(scope);
  const resourcePolicy: xray.CfnResourcePolicy = new xray.CfnResourcePolicy(scope, `${id}XRayDeliveryPolicy`, {
    policyName: Lazy.string({ produce: (): string => Names.uniqueResourceName(resourcePolicy, {
      maxLength: 128,
      separator: '-',
    }) }),
    policyDocument: stack.toJsonString(new iam.PolicyDocument({
      statements: [new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        principals: [new iam.ServicePrincipal('delivery.logs.amazonaws.com')],
        actions: ['xray:PutTraceSegments'],
        resources: ['*'],
        conditions: {
          'ForAllValues:ArnLike': {
            'logs:LogGeneratingResourceArns': [resourceArn],
          },
          StringEquals: { 'aws:SourceAccount': stack.account },
          ArnLike: {
            'aws:SourceArn': stack.formatArn({
              service: 'logs',
              resource: 'delivery-source',
              resourceName: '*',
              arnFormat: ArnFormat.COLON_RESOURCE_NAME,
            }),
          },
        },
      })],
    }).toJSON()),
  });

  const source: logs.CfnDeliverySource = new logs.CfnDeliverySource(scope, `${id}Source`, {
    name: Lazy.string({ produce: (): string => Names.uniqueResourceName(source, {
      maxLength: 60,
      separator: '-',
    }) }),
    logType: 'TRACES',
    resourceArn,
  });
  const destination: logs.CfnDeliveryDestination = new logs.CfnDeliveryDestination(scope, `${id}Destination`, {
    name: Lazy.string({ produce: (): string => Names.uniqueResourceName(destination, {
      maxLength: 60,
      separator: '-',
    }) }),
    deliveryDestinationType: 'XRAY',
  });
  destination.node.addDependency(resourcePolicy);

  const delivery = new logs.CfnDelivery(scope, `${id}Delivery`, {
    deliverySourceName: source.deliverySourceRef.deliverySourceName,
    deliveryDestinationArn: destination.attrArn,
  });
  delivery.node.addDependency(source, destination);
  return delivery;
}
