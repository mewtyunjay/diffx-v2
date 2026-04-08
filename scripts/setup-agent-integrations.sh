#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

LOCAL_BIN_DIR="${HOME}/.local/bin"
DIFFX_BIN_PATH="${LOCAL_BIN_DIR}/diffx"

CLAUDE_COMMANDS_DIR="${HOME}/.claude/commands"
CLAUDE_COMMAND_PATH="${CLAUDE_COMMANDS_DIR}/diffx.md"

CODEX_SKILL_DIR="${HOME}/.codex/skills/diffx"
CODEX_SKILL_PATH="${CODEX_SKILL_DIR}/SKILL.md"

MIN_GO_MAJOR=1
MIN_GO_MINOR=25
MIN_NODE_MAJOR=20

fail() {
  echo "[setup] error: $1" >&2
  exit 1
}

log() {
  echo "[setup] $1"
}

os_hint_install() {
  local tool="$1"
  case "$(uname -s)" in
    Darwin)
      case "$tool" in
        go)
          cat <<'TXT' >&2
Install Go (macOS):
  brew install go
TXT
          ;;
        node)
          cat <<'TXT' >&2
Install Node.js + npm (macOS):
  brew install node
TXT
          ;;
      esac
      ;;
    Linux)
      case "$tool" in
        go)
          cat <<'TXT' >&2
Install Go (Linux):
  sudo apt-get update && sudo apt-get install -y golang-go
If the package version is older than 1.25, install from:
  https://go.dev/doc/install
TXT
          ;;
        node)
          cat <<'TXT' >&2
Install Node.js 20+ + npm (Linux via nvm):
  curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
  nvm install 20
TXT
          ;;
      esac
      ;;
    *)
      cat <<'TXT' >&2
Unsupported OS for this installer. Use macOS or Linux.
TXT
      ;;
  esac
}

require_command() {
  local command_name="$1"
  local tool_name="$2"

  if ! command -v "$command_name" >/dev/null 2>&1; then
    os_hint_install "$tool_name"
    fail "missing required command: ${command_name}"
  fi
}

parse_go_version() {
  local raw="$1"
  raw="${raw#go version go}"
  raw="${raw%% *}"
  raw="${raw#v}"
  raw="${raw%%[^0-9.]*}"
  echo "$raw"
}

parse_node_version() {
  local raw="$1"
  raw="${raw#v}"
  raw="${raw%%[^0-9.]*}"
  echo "$raw"
}

version_component() {
  local version="$1"
  local index="$2"
  awk -F'.' -v idx="$index" '{ if (NF >= idx) print $idx; else print 0 }' <<<"$version"
}

ensure_go_version() {
  local parsed
  local major
  local minor

  parsed="$(parse_go_version "$(go version)")"
  major="$(version_component "$parsed" 1)"
  minor="$(version_component "$parsed" 2)"

  if (( major < MIN_GO_MAJOR )) || { (( major == MIN_GO_MAJOR )) && (( minor < MIN_GO_MINOR )); }; then
    os_hint_install go
    fail "Go ${MIN_GO_MAJOR}.${MIN_GO_MINOR}+ required; found ${parsed}"
  fi
}

ensure_node_version() {
  local parsed
  local major

  parsed="$(parse_node_version "$(node --version)")"
  major="$(version_component "$parsed" 1)"

  if (( major < MIN_NODE_MAJOR )); then
    os_hint_install node
    fail "Node ${MIN_NODE_MAJOR}+ required; found ${parsed}"
  fi
}

ensure_supported_os() {
  case "$(uname -s)" in
    Darwin|Linux)
      ;;
    *)
      fail "unsupported OS: $(uname -s). This installer supports macOS and Linux."
      ;;
  esac
}

ensure_repo_root() {
  if [[ ! -f "${REPO_ROOT}/go.mod" || ! -f "${REPO_ROOT}/cmd/diffx/main.go" ]]; then
    fail "could not locate diffx repo root from script path"
  fi
}

write_claude_command() {
  mkdir -p "${CLAUDE_COMMANDS_DIR}"

  cat > "${CLAUDE_COMMAND_PATH}" <<'MD'
---
description: Open interactive Diffx review and send annotations back to this chat
argument-hint: [optional diffx review args]
allowed-tools: Bash(diffx:*)
---

## Diffx Review

!`diffx review $ARGUMENTS`

## Your task

If the user is asking a question or asking why something changed, answer directly and do not edit files.
Only make code edits when the user explicitly asks for an edit or implementation.
If the user explicitly asks for edits and the review output above contains requested changes, address them in this session.
MD
}

write_codex_skill() {
  mkdir -p "${CODEX_SKILL_DIR}"

  cat > "${CODEX_SKILL_PATH}" <<'MD'
---
name: diffx
description: Launch Diffx interactive review, receive annotation feedback via stdout, and continue implementation in the same Codex thread.
allowed-tools: Bash(diffx:*)
---

# Diffx Review

Use this skill when the user wants interactive annotation-based code review with Diffx and expects feedback to return into the current Codex thread.

## Workflow

1. Run `diffx review` with any explicit arguments provided by the user.
2. Wait for the UI review to be submitted via "Send to agent".
3. Read stdout from the command. Diffx exits after feedback is submitted.
4. Route by user intent:
   - If the user is asking a question or asking why something changed, answer directly and do not edit files.
   - Only make code edits when the user explicitly asks for an edit or implementation.
5. If the user explicitly asked for edits and stdout includes requested fixes, implement them now.
6. If stdout says no changes were requested, acknowledge and continue.

## Notes

- Diffx review mode is one-shot: after feedback submission, the process exits.
- Treat returned review feedback as blocking only when the user explicitly asked for edits.
MD
}

print_path_hint_if_needed() {
  if [[ ":${PATH}:" != *":${LOCAL_BIN_DIR}:"* ]]; then
    log "${LOCAL_BIN_DIR} is not currently on your PATH."

    case "${SHELL##*/}" in
      zsh)
        cat <<'TXT'
Add it manually with:
  echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc
  source ~/.zshrc
TXT
        ;;
      bash)
        cat <<'TXT'
Add it manually with:
  echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
  source ~/.bashrc
TXT
        ;;
      *)
        cat <<'TXT'
Add it manually with:
  export PATH="$HOME/.local/bin:$PATH"
Then persist it in your shell startup file.
TXT
        ;;
    esac
  fi
}

main() {
  ensure_supported_os
  ensure_repo_root

  require_command go go
  require_command node node
  require_command npm node

  ensure_go_version
  ensure_node_version

  mkdir -p "${LOCAL_BIN_DIR}"

  log "Building frontend bundle (go generate ./frontend)..."
  (
    cd "${REPO_ROOT}"
    go generate ./frontend
  )

  log "Building diffx binary (${DIFFX_BIN_PATH})..."
  (
    cd "${REPO_ROOT}"
    go build -o "${DIFFX_BIN_PATH}" ./cmd/diffx
  )
  chmod +x "${DIFFX_BIN_PATH}"

  log "Installing Claude command (${CLAUDE_COMMAND_PATH})..."
  write_claude_command

  log "Installing Codex skill (${CODEX_SKILL_PATH})..."
  write_codex_skill

  cat <<TXT
[setup] Done.
[setup] Installed diffx binary: ${DIFFX_BIN_PATH}
[setup] Installed Claude command: ${CLAUDE_COMMAND_PATH}
[setup] Installed Codex skill: ${CODEX_SKILL_PATH}

Usage:
  Claude Code: /diffx [optional args]
  Codex:       \$diffx [optional args in prompt]
TXT

  print_path_hint_if_needed
}

main "$@"
