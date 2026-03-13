#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_PORT="${BACKEND_PORT:-7001}"
FRONTEND_PORT="${FRONTEND_PORT:-7010}"

cd "$ROOT_DIR"

if [[ ! -f "$ROOT_DIR/requirements.txt" || ! -d "$ROOT_DIR/app" || ! -d "$ROOT_DIR/frontend" ]]; then
  echo "Error: start-local.sh must be run from the repository root: $ROOT_DIR"
  exit 1
fi

if [[ ! -d .venv ]]; then
  python3 -m venv .venv
fi

# shellcheck disable=SC1091
source .venv/bin/activate

pip install -q -r requirements.txt

port_in_use() {
  local p="$1"
  if command -v lsof >/dev/null 2>&1; then
    lsof -iTCP:"$p" -sTCP:LISTEN >/dev/null 2>&1
  else
    nc -z 127.0.0.1 "$p" >/dev/null 2>&1
  fi
}

next_free_port() {
  local p="$1"
  while port_in_use "$p"; do
    p=$((p + 1))
  done
  echo "$p"
}

BACKEND_PORT="$(next_free_port "$BACKEND_PORT")"
FRONTEND_PORT="$(next_free_port "$FRONTEND_PORT")"
if [[ "$FRONTEND_PORT" == "$BACKEND_PORT" ]]; then
  FRONTEND_PORT="$(next_free_port "$((BACKEND_PORT + 1))")"
fi

LOG_DIR="$ROOT_DIR/.run-logs"
mkdir -p "$LOG_DIR"
BACK_LOG="$LOG_DIR/backend.log"
FRONT_LOG="$LOG_DIR/frontend.log"

cleanup() {
  echo "\nShutting down..."
  [[ -n "${BACK_PID:-}" ]] && kill "$BACK_PID" 2>/dev/null || true
  [[ -n "${FRONT_PID:-}" ]] && kill "$FRONT_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

uvicorn app.main:app --reload --host 127.0.0.1 --port "$BACKEND_PORT" >"$BACK_LOG" 2>&1 &
BACK_PID=$!

cd "$ROOT_DIR/frontend"
[[ -d node_modules ]] || npm install
NEXT_PUBLIC_API_URL="http://127.0.0.1:${BACKEND_PORT}" npm run dev -- --hostname 127.0.0.1 --port "$FRONTEND_PORT" >"$FRONT_LOG" 2>&1 &
FRONT_PID=$!

wait_for_url() {
  local url="$1"
  local retries="${2:-90}"
  local delay="${3:-1}"
  for _ in $(seq 1 "$retries"); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      return 0
    fi
    # fail fast if process crashed
    if [[ -n "${BACK_PID:-}" ]] && ! kill -0 "$BACK_PID" 2>/dev/null; then
      return 2
    fi
    if [[ -n "${FRONT_PID:-}" ]] && ! kill -0 "$FRONT_PID" 2>/dev/null; then
      return 3
    fi
    sleep "$delay"
  done
  return 1
}

echo "Backend:  http://127.0.0.1:${BACKEND_PORT}"
echo "Frontend: http://127.0.0.1:${FRONTEND_PORT}"
echo "Logs: $BACK_LOG | $FRONT_LOG"

if wait_for_url "http://127.0.0.1:${FRONTEND_PORT}"; then
  if command -v open >/dev/null 2>&1; then
    open "http://127.0.0.1:${FRONTEND_PORT}" || true
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "http://127.0.0.1:${FRONTEND_PORT}" || true
  fi
  echo "Browser opened automatically."
else
  status=$?
  echo "Frontend not reachable (status=$status). Recent logs:"
  echo "--- backend.log ---"
  tail -n 60 "$BACK_LOG" || true
  echo "--- frontend.log ---"
  tail -n 60 "$FRONT_LOG" || true
  exit 1
fi

echo "Press Ctrl+C to stop both."

# macOS ships Bash 3.2 (no `wait -n`). Keep process alive by waiting on both PIDs.
wait "$BACK_PID" "$FRONT_PID"
