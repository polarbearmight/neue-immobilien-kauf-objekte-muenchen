#!/usr/bin/env bash
set -euo pipefail

# One-command local start for this project (fixed working ports)
BACKEND_PORT="${BACKEND_PORT:-7001}" FRONTEND_PORT="${FRONTEND_PORT:-7010}" "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/start-local.sh"
