#!/usr/bin/env bash
set -euo pipefail

: "${DEPLOY_ACCOUNT_ID:?Set DEPLOY_ACCOUNT_ID outside the repository.}"
: "${AWS_APP_ID:?Set AWS_APP_ID to the Amplify application ID.}"
: "${AWS_BRANCH:=main}"
: "${AWS_REGION:=ap-northeast-1}"

if [[ "$AWS_REGION" != "ap-northeast-1" ]]; then
  echo "Deployment is restricted to ap-northeast-1." >&2
  exit 1
fi

if ! aws sts get-caller-identity >/dev/null 2>&1; then
  aws login
fi

ACTUAL_ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
if [[ "$ACTUAL_ACCOUNT_ID" != "$DEPLOY_ACCOUNT_ID" ]]; then
  echo "The active AWS account does not match DEPLOY_ACCOUNT_ID." >&2
  exit 1
fi

npm ci
npm run package:agent
npm run check
npx ampx pipeline-deploy --branch "$AWS_BRANCH" --app-id "$AWS_APP_ID"

echo "Backend deployment completed. Push to the configured branch to publish the frontend."
