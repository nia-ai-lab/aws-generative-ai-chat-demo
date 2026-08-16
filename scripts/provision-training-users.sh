#!/usr/bin/env bash
set -euo pipefail
set +x

: "${STUDENT_USERNAME:?Set STUDENT_USERNAME.}"
: "${STUDENT_PASSWORD:?Set STUDENT_PASSWORD.}"
: "${ADMIN_USERNAME:?Set ADMIN_USERNAME.}"
: "${ADMIN_PASSWORD:?Set ADMIN_PASSWORD.}"
: "${AWS_REGION:=ap-northeast-1}"

if ! aws sts get-caller-identity >/dev/null 2>&1; then
  aws login
fi

USER_POOL_ID="$(jq -r '.auth.user_pool_id // empty' amplify_outputs.json)"
if [[ -z "$USER_POOL_ID" ]]; then
  echo "Run the Amplify deployment first so amplify_outputs.json contains the User Pool ID." >&2
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

echo "Training users were provisioned without writing credentials to the repository."
