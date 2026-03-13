#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

if [[ ! -d .venv ]]; then
  echo "[setup] Creating virtual environment..."
  python3 -m venv .venv
fi

# shellcheck disable=SC1091
source .venv/bin/activate

echo "[setup] Installing requirements..."
pip install -q -r requirements.txt

export ALLOW_UNAPPROVED_SOURCES="${ALLOW_UNAPPROVED_SOURCES:-true}"
export REQUEST_DELAY_SECONDS="${REQUEST_DELAY_SECONDS:-4}"
unset DISABLED_SOURCES || true

echo "[collect] Running all collectors..."
python -m collectors.run_collect

echo "[start] Launching backend + frontend..."
"$ROOT_DIR/immostart.sh"
