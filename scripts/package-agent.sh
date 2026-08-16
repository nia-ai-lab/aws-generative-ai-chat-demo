#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
TASK_TEMP_DIR="$(mktemp -d)"
PACKAGE_DIR="$TASK_TEMP_DIR/package"
OUTPUT_DIR="$PROJECT_DIR/agent/dist"
OUTPUT_FILE="$OUTPUT_DIR/agent.zip"

cleanup() {
  rm -rf -- "$TASK_TEMP_DIR"
}
trap cleanup EXIT

mkdir -p "$PACKAGE_DIR" "$OUTPUT_DIR"

if command -v uv >/dev/null 2>&1; then
  UV_BIN="$(command -v uv)"
else
  python3 -m venv "$TASK_TEMP_DIR/uv-tool"
  "$TASK_TEMP_DIR/uv-tool/bin/python" -m pip install --quiet "uv==0.12.5"
  UV_BIN="$TASK_TEMP_DIR/uv-tool/bin/uv"
fi

"$UV_BIN" pip install \
  --python-platform aarch64-manylinux2014 \
  --python-version 3.12 \
  --target "$PACKAGE_DIR" \
  --only-binary=:all: \
  --requirements "$PROJECT_DIR/agent/requirements.lock"

cp "$PROJECT_DIR/agent/main.py" "$PACKAGE_DIR/main.py"
cp "$PROJECT_DIR/agent/graph.py" "$PACKAGE_DIR/graph.py"
cp "$PROJECT_DIR/agent/prompts.py" "$PACKAGE_DIR/prompts.py"
cp "$PROJECT_DIR/agent/schemas.py" "$PACKAGE_DIR/schemas.py"

find "$PACKAGE_DIR" -type d -name '__pycache__' -prune -exec rm -rf -- {} +
rm -f -- "$OUTPUT_FILE"
(cd "$PACKAGE_DIR" && zip -q -r "$OUTPUT_FILE" .)

SIZE_BYTES="$(wc -c < "$OUTPUT_FILE" | tr -d ' ')"
if (( SIZE_BYTES > 250000000 )); then
  echo "Agent package exceeds the 250 MB direct-code limit." >&2
  exit 1
fi

echo "Agent package ready: agent/dist/agent.zip ($SIZE_BYTES bytes)"
