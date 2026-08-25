#!/usr/bin/env bash
set -euo pipefail

: "${DEPLOY_ACCOUNT_ID:?Set DEPLOY_ACCOUNT_ID to the target AWS account ID.}"
: "${AWS_REGION:=ap-northeast-1}"
: "${CONFIG_FUNCTION_NAME:=generative-ai-chat-config}"
: "${CHAT_FUNCTION_NAME:=generative-ai-chat-stream}"

if [[ "$AWS_REGION" != "ap-northeast-1" ]]; then
  echo "Participant access smoke testing is restricted to ap-northeast-1." >&2
  exit 1
fi

for command_name in aws jq; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Required command is not available: $command_name" >&2
    exit 1
  fi
done

if ! ACTUAL_ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text 2>/dev/null)"; then
  echo "AWS authentication is unavailable. Run aws login, then retry." >&2
  exit 1
fi

if [[ "$ACTUAL_ACCOUNT_ID" != "$DEPLOY_ACCOUNT_ID" ]]; then
  echo "The active AWS account does not match DEPLOY_ACCOUNT_ID." >&2
  exit 1
fi

SMOKE_DIR="$(mktemp -d)"
ORIGINAL_ACCESS_ENABLED=""
ACCESS_CHANGED="false"
RESTORE_COMPLETED="false"

admin_event() {
  local method="$1"
  local body="${2:-}"
  jq -cn \
    --arg method "$method" \
    --arg body "$body" \
    '{
      httpMethod: $method,
      path: "/admin/config",
      headers: {},
      requestContext: {authorizer: {sub: "participant-access-smoke-admin", groups: "Admins"}}
    } + (if $body == "" then {} else {body: $body} end)'
}

invoke_config() {
  local event="$1"
  local output="$2"
  local metadata
  metadata="$(aws lambda invoke \
    --function-name "$CONFIG_FUNCTION_NAME" \
    --region "$AWS_REGION" \
    --cli-binary-format raw-in-base64-out \
    --payload "$event" \
    "$output")"
  jq -e '.StatusCode == 200 and (.FunctionError | not)' <<<"$metadata" >/dev/null
}

config_body_with_access() {
  local config_file="$1"
  local enabled="$2"
  jq -c --argjson enabled "$enabled" '
    .body | fromjson | {
      expectedConfigVersion: .configVersion,
      participantAccessEnabled: $enabled,
      defaultModelKey,
      enabledModelKeys,
      defaultSystemPrompt,
      requiredGuardrailKeys,
      enabledToolKeys,
      usdToJpyRate
    }
  ' "$config_file"
}

restore_original_access() {
  if [[ "$ACCESS_CHANGED" != "true" || "$RESTORE_COMPLETED" == "true" ]]; then
    return
  fi

  local current_file="$SMOKE_DIR/restore-current.json"
  local restored_file="$SMOKE_DIR/restored.json"
  local body event
  invoke_config "$(admin_event GET)" "$current_file"
  body="$(config_body_with_access "$current_file" "$ORIGINAL_ACCESS_ENABLED")"
  event="$(admin_event PUT "$body")"
  invoke_config "$event" "$restored_file"
  jq -e --argjson expected "$ORIGINAL_ACCESS_ENABLED" \
    '.statusCode == 200 and (.body | fromjson | .participantAccessEnabled == $expected)' \
    "$restored_file" >/dev/null
  RESTORE_COMPLETED="true"
}

cleanup() {
  local exit_status="$?"
  set +e
  restore_original_access
  local restore_status="$?"
  if [[ -d "$SMOKE_DIR" ]]; then
    rm -rf -- "$SMOKE_DIR"
  fi
  if [[ "$restore_status" -ne 0 ]]; then
    echo "Failed to restore the original participant access setting." >&2
    exit "$restore_status"
  fi
  exit "$exit_status"
}
trap cleanup EXIT

CURRENT_FILE="$SMOKE_DIR/current.json"
DISABLED_FILE="$SMOKE_DIR/disabled.json"
CHAT_FILE="$SMOKE_DIR/chat.json"

invoke_config "$(admin_event GET)" "$CURRENT_FILE"
jq -e '.statusCode == 200' "$CURRENT_FILE" >/dev/null
ORIGINAL_ACCESS_ENABLED="$(jq -r '.body | fromjson | .participantAccessEnabled' "$CURRENT_FILE")"

if [[ "$ORIGINAL_ACCESS_ENABLED" == "true" ]]; then
  DISABLE_BODY="$(config_body_with_access "$CURRENT_FILE" false)"
  # Mark restoration as required before making the mutating request. This keeps
  # the original setting recoverable even if the command succeeds remotely but
  # its local response validation fails.
  ACCESS_CHANGED="true"
  invoke_config "$(admin_event PUT "$DISABLE_BODY")" "$DISABLED_FILE"
  jq -e '.statusCode == 200 and (.body | fromjson | .participantAccessEnabled == false)' \
    "$DISABLED_FILE" >/dev/null
fi

CHAT_EVENT='{
  "httpMethod": "POST",
  "path": "/chat",
  "headers": {"Authorization": "Bearer participant-access-smoke-token"},
  "requestContext": {"authorizer": {"sub": "participant-access-smoke-student", "groups": "Students"}},
  "body": "{}"
}'
CHAT_INVOKE_METADATA="$(aws lambda invoke \
  --function-name "$CHAT_FUNCTION_NAME" \
  --region "$AWS_REGION" \
  --cli-binary-format raw-in-base64-out \
  --payload "$CHAT_EVENT" \
  "$CHAT_FILE")"

jq -e '.StatusCode == 200 and (.FunctionError | not)' <<<"$CHAT_INVOKE_METADATA" >/dev/null

# A normal Lambda Invoke buffers a streamified handler and writes only its response
# payload to the output file. HTTP status metadata is applied by the streaming API
# integration, so this direct backend smoke test validates the stable error code.
jq -e '.code == "PARTICIPANT_ACCESS_DISABLED"' "$CHAT_FILE" >/dev/null

restore_original_access

FINAL_FILE="$SMOKE_DIR/final.json"
invoke_config "$(admin_event GET)" "$FINAL_FILE"
jq -e --argjson expected "$ORIGINAL_ACCESS_ENABLED" \
  '.statusCode == 200 and (.body | fromjson | .participantAccessEnabled == $expected)' \
  "$FINAL_FILE" >/dev/null

jq -n \
  --argjson originalAccessEnabled "$ORIGINAL_ACCESS_ENABLED" \
  --arg rejectionCode "$(jq -r '.code' "$CHAT_FILE")" \
  --argjson restoredAccessEnabled "$(jq '.body | fromjson | .participantAccessEnabled' "$FINAL_FILE")" \
  '{
    result: "PASS",
    originalAccessEnabled: $originalAccessEnabled,
    studentRejectionCode: $rejectionCode,
    restoredAccessEnabled: $restoredAccessEnabled
  }'
