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

echo "Backend:  http://127.0.0.1:${BACKEND_PORT}"
echo "Frontend: http://127.0.0.1:${FRONTEND_PORT}"
echo "Press Ctrl+C to stop both."

wait -n "$BACK_PID" "$FRONT_PID"
