#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_PORT="${BACKEND_PORT:-8001}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"

cd "$ROOT_DIR"

if [[ ! -d .venv ]]; then
  python3 -m venv .venv
fi

# shellcheck disable=SC1091
source .venv/bin/activate

pip install -q -r requirements.txt

cleanup() {
  echo "\nShutting down..."
  [[ -n "${BACK_PID:-}" ]] && kill "$BACK_PID" 2>/dev/null || true
  [[ -n "${FRONT_PID:-}" ]] && kill "$FRONT_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

uvicorn app.main:app --reload --host 127.0.0.1 --port "$BACKEND_PORT" &
BACK_PID=$!

cd "$ROOT_DIR/frontend"
[[ -d node_modules ]] || npm install
NEXT_PUBLIC_API_URL="http://127.0.0.1:${BACKEND_PORT}" npm run dev -- --port "$FRONTEND_PORT" &
FRONT_PID=$!

wait_for_url() {
  local url="$1"
  local retries="${2:-90}"
  local delay="${3:-1}"
  for _ in $(seq 1 "$retries"); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep "$delay"
  done
  return 1
}

echo "Backend:  http://127.0.0.1:${BACKEND_PORT}"
echo "Frontend: http://127.0.0.1:${FRONTEND_PORT}"

if wait_for_url "http://127.0.0.1:${FRONTEND_PORT}"; then
  if command -v open >/dev/null 2>&1; then
    open "http://127.0.0.1:${FRONTEND_PORT}" || true
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "http://127.0.0.1:${FRONTEND_PORT}" || true
  fi
  echo "Browser opened automatically."
else
  echo "Frontend did not become reachable in time. Check logs above (port conflict or npm error)."
fi

echo "Press Ctrl+C to stop both."
wait -n "$BACK_PID" "$FRONT_PID"
