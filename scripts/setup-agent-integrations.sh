#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "[setup] scripts/setup-agent-integrations.sh is deprecated." >&2
echo "[setup] Use scripts/install.sh instead." >&2

exec "${SCRIPT_DIR}/install.sh" "$@"
