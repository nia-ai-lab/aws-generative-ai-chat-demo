#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${LOAD_TEST_ACCESS_TOKEN:-}" && -z "${LOAD_TEST_USERNAME:-}" ]]; then
  echo "Set LOAD_TEST_USERNAME, or provide LOAD_TEST_ACCESS_TOKEN." >&2
  exit 1
fi

if [[ -z "${LOAD_TEST_ACCESS_TOKEN:-}" && -z "${LOAD_TEST_PASSWORD:-}" ]]; then
  read -r -s -p "Training user password: " LOAD_TEST_PASSWORD
  echo
  export LOAD_TEST_PASSWORD
fi

cleanup() {
  unset LOAD_TEST_PASSWORD LOAD_TEST_ACCESS_TOKEN
}
trap cleanup EXIT

node scripts/load-test-chat.mjs
