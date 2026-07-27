#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PORT:-8811}"
mkdir -p docs/screens

python3 -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1 &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null || true' EXIT

until curl -sf -o /dev/null "http://127.0.0.1:$PORT/index.html"; do sleep 0.2; done

if [ -z "${PW_MODULE:-}" ] || [ -z "${PW_EXECUTABLE:-}" ]; then
  eval "$(node "$HOME/.claude/skills/playwright-gotchas/scripts/resolve-playwright.mjs" 2>/dev/null)"
fi

BASE_URL="http://127.0.0.1:$PORT" node checks/site-check.mjs "$@"
