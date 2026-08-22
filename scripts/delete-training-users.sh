#!/usr/bin/env bash
set -euo pipefail
set +x

: "${DEPLOY_ACCOUNT_ID:?Set DEPLOY_ACCOUNT_ID outside the repository.}"
: "${STUDENT_USERNAME:?Set STUDENT_USERNAME.}"
: "${ADMIN_USERNAME:?Set ADMIN_USERNAME.}"
: "${AWS_REGION:=ap-northeast-1}"

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
OUTPUTS_FILE="$PROJECT_DIR/amplify_outputs.json"

if [[ "$STUDENT_USERNAME" == "$ADMIN_USERNAME" ]]; then
  echo "STUDENT_USERNAME and ADMIN_USERNAME must be different." >&2
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

if [[ ! -f "$OUTPUTS_FILE" ]]; then
  echo "amplify_outputs.json was not found. Refusing to guess the User Pool." >&2
  exit 1
fi

USER_POOL_ID="$(jq -r '.auth.user_pool_id // empty' "$OUTPUTS_FILE")"
OUTPUT_REGION="$(jq -r '.auth.aws_region // empty' "$OUTPUTS_FILE")"
if [[ -z "$USER_POOL_ID" || -z "$OUTPUT_REGION" ]]; then
  echo "amplify_outputs.json does not contain the Cognito User Pool settings." >&2
  exit 1
fi
if [[ "$AWS_REGION" != "$OUTPUT_REGION" ]]; then
  echo "AWS_REGION does not match the region in amplify_outputs.json." >&2
  exit 1
fi

echo "The following Cognito users will be deleted:"
echo "  Account:   $ACTUAL_ACCOUNT_ID"
echo "  Region:    $AWS_REGION"
echo "  User Pool: $USER_POOL_ID"
echo "  Student:   $STUDENT_USERNAME"
echo "  Admin:     $ADMIN_USERNAME"

if [[ "${CONFIRM_DELETE_TRAINING_USERS:-}" != "delete-training-users" ]]; then
  if [[ ! -t 0 ]]; then
    echo "Set CONFIRM_DELETE_TRAINING_USERS=delete-training-users to confirm deletion." >&2
    exit 1
  fi
  read -r -p "Type delete-training-users to continue: " CONFIRMATION
  if [[ "$CONFIRMATION" != "delete-training-users" ]]; then
    echo "Deletion cancelled."
    exit 1
  fi
fi

delete_user() {
  local username="$1"

  if aws cognito-idp admin-get-user \
    --region "$AWS_REGION" \
    --user-pool-id "$USER_POOL_ID" \
    --username "$username" >/dev/null 2>&1; then
    aws cognito-idp admin-delete-user \
      --region "$AWS_REGION" \
      --user-pool-id "$USER_POOL_ID" \
      --username "$username"
    echo "Deleted $username."
  else
    echo "Skipped $username because it does not exist."
  fi
}

delete_user "$STUDENT_USERNAME"
delete_user "$ADMIN_USERNAME"

echo "Training users were deleted. Other Cognito users and application resources were not changed."
