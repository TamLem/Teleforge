#!/usr/bin/env bash
set -euo pipefail

MODE="mock"
if [[ -n "${TEST_BOT_TOKEN:-}" && -n "${TEST_MINI_APP_URL:-}" && -n "${TEST_BOT_ID:-}" && -n "${TEST_PUBLIC_KEY:-}" ]]; then
  MODE="live"
fi

echo "[task-shop] running integration suite in ${MODE} mode"
pnpm test:integration
