#!/usr/bin/env bash
set -euo pipefail

: "${DEPLOY_ACCOUNT_ID:?Set DEPLOY_ACCOUNT_ID outside the repository.}"
: "${AWS_APP_ID:?Set AWS_APP_ID.}"
: "${AWS_REGION:=ap-northeast-1}"

if [[ "${CONFIRM_DESTROY:-}" != "delete-generative-ai-chat" ]]; then
  echo "Set CONFIRM_DESTROY=delete-generative-ai-chat to confirm deletion." >&2
  exit 1
fi

if ! aws sts get-caller-identity >/dev/null 2>&1; then
  aws login
fi

ACTUAL_ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
if [[ "$ACTUAL_ACCOUNT_ID" != "$DEPLOY_ACCOUNT_ID" || "$AWS_REGION" != "ap-northeast-1" ]]; then
  echo "Account or region guard failed." >&2
  exit 1
fi

aws amplify delete-app --region "$AWS_REGION" --app-id "$AWS_APP_ID" >/dev/null
echo "The Amplify app and its application-specific backend were requested for deletion."
