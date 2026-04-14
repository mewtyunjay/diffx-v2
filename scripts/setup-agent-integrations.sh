#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

LOCAL_BIN_DIR="${HOME}/.local/bin"
DIFFX_BIN_PATH="${LOCAL_BIN_DIR}/diffx"

log() {
  echo "[setup] $1"
}

fail() {
  echo "[setup] error: $1" >&2
  exit 1
}

ensure_command() {
  local command_name="$1"
  if ! command -v "${command_name}" >/dev/null 2>&1; then
    fail "missing required command: ${command_name}"
  fi
}

ensure_repo_root() {
  if [[ ! -f "${REPO_ROOT}/go.mod" || ! -f "${REPO_ROOT}/cmd/diffx/main.go" ]]; then
    fail "could not locate diffx repo root from script path"
  fi
}

print_path_hint_if_needed() {
  if [[ ":${PATH}:" != *":${LOCAL_BIN_DIR}:"* ]]; then
    echo ""
    log "${LOCAL_BIN_DIR} is not on your PATH."
    case "${SHELL##*/}" in
      zsh)
        cat <<'TXT'
Add it with:
  echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc
  source ~/.zshrc
TXT
        ;;
      bash)
        cat <<'TXT'
Add it with:
  echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
  source ~/.bashrc
TXT
        ;;
      *)
        cat <<'TXT'
Add it with:
  export PATH="$HOME/.local/bin:$PATH"
Then persist it in your shell startup file.
TXT
        ;;
    esac
  fi
}

main() {
  ensure_repo_root
  ensure_command go
  ensure_command node
  ensure_command npm

  mkdir -p "${LOCAL_BIN_DIR}"

  log "Building frontend bundle (go generate ./frontend)..."
  (
    cd "${REPO_ROOT}"
    go generate ./frontend
  )

  log "Building local diffx binary (${DIFFX_BIN_PATH})..."
  (
    cd "${REPO_ROOT}"
    go build -o "${DIFFX_BIN_PATH}" ./cmd/diffx
  )
  chmod +x "${DIFFX_BIN_PATH}"

  log "Running local setup UI..."
  "${DIFFX_BIN_PATH}" setup "$@"

  cat <<TXT
[setup] Done.
[setup] Installed local binary: ${DIFFX_BIN_PATH}

Use:
  diffx
  diffx review
TXT

  print_path_hint_if_needed
}

main "$@"
