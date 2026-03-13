#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "Repository root: $ROOT_DIR"

[[ -d app ]] || { echo "Missing app/"; exit 1; }
[[ -d collectors ]] || { echo "Missing collectors/"; exit 1; }
[[ -d frontend ]] || { echo "Missing frontend/"; exit 1; }
[[ -f requirements.txt ]] || { echo "Missing requirements.txt"; exit 1; }

count_venv=$(find "$ROOT_DIR" -maxdepth 2 -type d -name '.venv' | wc -l)
count_db=$(find "$ROOT_DIR" -maxdepth 2 -type f -name 'local.db' | wc -l)

echo ".venv count (repo-local): $count_venv"
echo "local.db count (repo-local): $count_db"

if [[ "$count_venv" -gt 1 ]]; then
  echo "Warning: more than one .venv inside repo tree"
fi
if [[ "$count_db" -gt 1 ]]; then
  echo "Warning: more than one local.db inside repo tree"
fi

echo "OK: primary structure looks sane."
