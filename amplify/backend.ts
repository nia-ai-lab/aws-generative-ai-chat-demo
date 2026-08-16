import { defineBackend } from '@aws-amplify/backend';
import { Stack, Token } from 'aws-cdk-lib';
import { auth } from './auth/resource.js';
import { createApplicationResources } from './custom/application-stack.js';

const expectedAccount = process.env.DEPLOY_ACCOUNT_ID;
const deploymentAccount = process.env.CDK_DEFAULT_ACCOUNT;
const deploymentRegion = process.env.AWS_REGION ?? process.env.CDK_DEFAULT_REGION;

if (!expectedAccount) {
  throw new Error('DEPLOY_ACCOUNT_ID must be set outside the repository before deployment.');
}
if (deploymentAccount && deploymentAccount !== expectedAccount) {
  throw new Error('The active AWS account does not match DEPLOY_ACCOUNT_ID.');
}
if (deploymentRegion && deploymentRegion !== 'ap-northeast-1') {
  throw new Error('This application can only be deployed to ap-northeast-1.');
}

const backend = defineBackend({ auth });
backend.auth.resources.cfnResources.cfnUserPool.adminCreateUserConfig = {
  allowAdminCreateUserOnly: true,
};
const appStack = backend.createStack('GenerativeAIChat');
const stackAccount = Stack.of(appStack).account;
const stackRegion = Stack.of(appStack).region;
if (!Token.isUnresolved(stackAccount) && stackAccount !== expectedAccount) {
  throw new Error('The synthesized stack account does not match DEPLOY_ACCOUNT_ID.');
}
if (!Token.isUnresolved(stackRegion) && stackRegion !== 'ap-northeast-1') {
  throw new Error('The synthesized stack region must be ap-northeast-1.');
}
const resources = createApplicationResources(appStack, {
  userPool: backend.auth.resources.userPool,
  userPoolClient: backend.auth.resources.userPoolClient,
});

backend.addOutput({
  custom: {
    apiUrl: resources.apiUrl,
  },
});
