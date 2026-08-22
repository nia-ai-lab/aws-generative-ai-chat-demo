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

if [[ -n "${TRAINING_PASSWORD:-}" ]]; then
  STUDENT_PASSWORD="${STUDENT_PASSWORD:-$TRAINING_PASSWORD}"
  ADMIN_PASSWORD="${ADMIN_PASSWORD:-$TRAINING_PASSWORD}"
fi

if [[ -z "${STUDENT_PASSWORD:-}" && -z "${ADMIN_PASSWORD:-}" ]]; then
  if [[ ! -t 0 ]]; then
    echo "Set TRAINING_PASSWORD, or run interactively to enter the shared password." >&2
    exit 1
  fi

  read -r -s -p "Shared training user password: " SHARED_PASSWORD
  echo
  read -r -s -p "Confirm shared training user password: " SHARED_PASSWORD_CONFIRMATION
  echo
  if [[ -z "$SHARED_PASSWORD" || "$SHARED_PASSWORD" != "$SHARED_PASSWORD_CONFIRMATION" ]]; then
    echo "The passwords were empty or did not match." >&2
    exit 1
  fi
  STUDENT_PASSWORD="$SHARED_PASSWORD"
  ADMIN_PASSWORD="$SHARED_PASSWORD"
elif [[ -z "${STUDENT_PASSWORD:-}" || -z "${ADMIN_PASSWORD:-}" ]]; then
  echo "Set both STUDENT_PASSWORD and ADMIN_PASSWORD, or set TRAINING_PASSWORD." >&2
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
  echo "Run the Amplify deployment first so amplify_outputs.json contains the User Pool ID." >&2
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

create_user() {
  local username="$1"
  local password="$2"
  local group="$3"

  if ! aws cognito-idp admin-get-user --region "$AWS_REGION" --user-pool-id "$USER_POOL_ID" --username "$username" >/dev/null 2>&1; then
    aws cognito-idp admin-create-user \
      --region "$AWS_REGION" \
      --user-pool-id "$USER_POOL_ID" \
      --username "$username" \
      --temporary-password "$password" \
      --message-action SUPPRESS >/dev/null
  fi
  aws cognito-idp admin-set-user-password \
    --region "$AWS_REGION" \
    --user-pool-id "$USER_POOL_ID" \
    --username "$username" \
    --password "$password" \
    --permanent >/dev/null
  aws cognito-idp admin-add-user-to-group \
    --region "$AWS_REGION" \
    --user-pool-id "$USER_POOL_ID" \
    --username "$username" \
    --group-name "$group" >/dev/null
}

create_user "$STUDENT_USERNAME" "$STUDENT_PASSWORD" Students
create_user "$ADMIN_USERNAME" "$ADMIN_PASSWORD" Admins

echo "Training users were provisioned in User Pool $USER_POOL_ID."
echo "No credentials were written to the repository."
