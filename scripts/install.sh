#!/usr/bin/env bash
set -euo pipefail

REPO_SLUG_DEFAULT="mewtyunjay/diffx-v2"
RELEASE_VERSION_DEFAULT="latest"

LOCAL_BIN_DIR="${HOME}/.local/bin"
DIFFX_BIN_PATH="${LOCAL_BIN_DIR}/diffx"

STATE_ROOT="${XDG_DATA_HOME:-${HOME}/.local/share}"
CANONICAL_SKILL_DIR="${STATE_ROOT}/diffx/skills/diffx"
CANONICAL_SKILL_PATH="${CANONICAL_SKILL_DIR}/SKILL.md"

CLAUDE_COMMANDS_DIR="${HOME}/.claude/commands"
CLAUDE_COMMAND_PATH="${CLAUDE_COMMANDS_DIR}/diffx.md"

AGENT_IDS=(
  "universal"
  "claude"
  "codex"
  "cursor"
  "cline"
  "continue"
  "opencode"
  "kilo"
  "kiro"
  "warp"
  "gemini-cli"
  "github-copilot"
  "augment"
  "command-code"
  "cortex-code"
)

AGENT_LABELS=(
  "Universal (.agents/skills)"
  "Claude Code (.claude/skills)"
  "Codex (.codex/skills)"
  "Cursor (.cursor/skills)"
  "Cline (.cline/skills)"
  "Continue (.continue/skills)"
  "OpenCode (.opencode/skills)"
  "Kilo (.kilo/skills)"
  "Kiro (.kiro/skills)"
  "Warp (.warp/skills)"
  "Gemini CLI (.gemini/skills)"
  "GitHub Copilot (.github-copilot/skills)"
  "Augment (.augment/skills)"
  "Command Code (.commandcode/skills)"
  "Cortex Code (.cortex/skills)"
)

AGENT_PATHS=(
  "${HOME}/.agents/skills"
  "${HOME}/.claude/skills"
  "${HOME}/.codex/skills"
  "${HOME}/.cursor/skills"
  "${HOME}/.cline/skills"
  "${HOME}/.continue/skills"
  "${HOME}/.opencode/skills"
  "${HOME}/.kilo/skills"
  "${HOME}/.kiro/skills"
  "${HOME}/.warp/skills"
  "${HOME}/.gemini/skills"
  "${HOME}/.github-copilot/skills"
  "${HOME}/.augment/skills"
  "${HOME}/.commandcode/skills"
  "${HOME}/.cortex/skills"
)

ASSUME_YES=0
USE_SYMLINK=1
AGENTS_CSV=""
REPO_SLUG="${REPO_SLUG_DEFAULT}"
RELEASE_VERSION="${RELEASE_VERSION_DEFAULT}"

declare -a SELECTED

fail() {
  echo "[install] error: $1" >&2
  exit 1
}

log() {
  echo "[install] $1"
}

usage() {
  cat <<'TXT'
diffx installer

Usage:
  bash install.sh [options]

Options:
  --yes                   Run non-interactively using defaults
  --agents <csv>          Comma-separated agent IDs (see --list-agents)
  --copy                  Copy skill files instead of symlinking
  --symlink               Symlink skill files (default)
  --repo <owner/repo>     GitHub repo slug (default: mewtyunjay/diffx-v2)
  --version <tag|latest>  Release version to install (default: latest)
  --list-agents           Print curated agent targets and exit
  -h, --help              Show this help
TXT
}

list_agents() {
  local i
  echo "Available agent targets:"
  for i in "${!AGENT_IDS[@]}"; do
    local default_mark=""
    if is_default_agent "${AGENT_IDS[i]}"; then
      default_mark=" [default]"
    fi
    echo "  - ${AGENT_IDS[i]} -> ${AGENT_LABELS[i]} (${AGENT_PATHS[i]})${default_mark}"
  done
}

ensure_command() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    fail "missing required command: ${cmd}"
  fi
}

is_default_agent() {
  local id="$1"
  [[ "$id" == "universal" || "$id" == "claude" ]]
}

init_default_selection() {
  local i
  SELECTED=()
  for i in "${!AGENT_IDS[@]}"; do
    if is_default_agent "${AGENT_IDS[i]}"; then
      SELECTED[i]=1
    else
      SELECTED[i]=0
    fi
  done
}

find_agent_index() {
  local id="$1"
  local i
  for i in "${!AGENT_IDS[@]}"; do
    if [[ "${AGENT_IDS[i]}" == "$id" ]]; then
      echo "$i"
      return 0
    fi
  done
  echo "-1"
}

apply_agents_csv() {
  local csv="$1"
  local trimmed token idx i
  for i in "${!SELECTED[@]}"; do
    SELECTED[i]=0
  done

  IFS=',' read -r -a raw_tokens <<<"$csv"
  for token in "${raw_tokens[@]}"; do
    trimmed="$(echo "$token" | xargs)"
    [[ -z "$trimmed" ]] && continue
    idx="$(find_agent_index "$trimmed")"
    if [[ "$idx" == "-1" ]]; then
      fail "unknown agent id '${trimmed}'. Use --list-agents."
    fi
    SELECTED[idx]=1
  done

  ensure_selection_present
}

selected_count() {
  local i count=0
  for i in "${!SELECTED[@]}"; do
    if [[ "${SELECTED[i]}" == "1" ]]; then
      count=$((count + 1))
    fi
  done
  echo "$count"
}

ensure_selection_present() {
  if [[ "$(selected_count)" == "0" ]]; then
    fail "at least one agent target must be selected"
  fi
}

interactive_agent_selection() {
  local input token idx i

  if [[ ! -t 0 || ! -t 1 ]]; then
    fail "interactive selection requires a TTY. Re-run with --yes or --agents."
  fi

  while true; do
    printf '\n'
    echo "skills"
    echo ""
    echo "Install diffx skill to agent targets (symlink mode by default)."
    echo "Defaults: Universal + Claude Code."
    echo ""
    echo "Select targets to install:"

    for i in "${!AGENT_IDS[@]}"; do
      local mark=" "
      local exists="new"
      if [[ "${SELECTED[i]}" == "1" ]]; then
        mark="x"
      fi
      if [[ -d "${AGENT_PATHS[i]}" ]]; then
        exists="exists"
      fi
      printf " %2d) [%s] %-36s  (%s)\n" "$((i + 1))" "$mark" "${AGENT_LABELS[i]}" "$exists"
    done

    echo ""
    read -r -p "Toggle by number(s), 'a' all, 'n' none, 'c' confirm: " input

    case "${input}" in
      ""|"c"|"C")
        if [[ "$(selected_count)" == "0" ]]; then
          echo "Select at least one target."
          continue
        fi
        break
        ;;
      "a"|"A")
        for i in "${!SELECTED[@]}"; do
          SELECTED[i]=1
        done
        ;;
      "n"|"N")
        for i in "${!SELECTED[@]}"; do
          SELECTED[i]=0
        done
        ;;
      *)
        input="${input//,/ }"
        for token in $input; do
          if [[ "$token" =~ ^[0-9]+$ ]]; then
            idx=$((token - 1))
            if (( idx < 0 || idx >= ${#AGENT_IDS[@]} )); then
              echo "Ignoring out-of-range selection: ${token}"
              continue
            fi
            if [[ "${SELECTED[idx]}" == "1" ]]; then
              SELECTED[idx]=0
            else
              SELECTED[idx]=1
            fi
          else
            echo "Ignoring invalid token: ${token}"
          fi
        done
        ;;
    esac
  done
}

resolve_platform() {
  local uname_s uname_m os arch
  uname_s="$(uname -s)"
  uname_m="$(uname -m)"

  case "$uname_s" in
    Darwin) os="darwin" ;;
    Linux) os="linux" ;;
    *) fail "unsupported OS: ${uname_s} (supported: macOS, Linux)" ;;
  esac

  case "$uname_m" in
    x86_64|amd64) arch="x86_64" ;;
    arm64|aarch64) arch="arm64" ;;
    *) fail "unsupported architecture: ${uname_m} (supported: x86_64, arm64)" ;;
  esac

  echo "${os} ${arch}"
}

download_and_install_binary() {
  local os arch asset_name release_path url tmp_dir archive_path binary_path
  read -r os arch <<<"$(resolve_platform)"

  asset_name="diffx_${os}_${arch}.tar.gz"
  if [[ "$RELEASE_VERSION" == "latest" ]]; then
    release_path="latest/download"
  else
    release_path="download/${RELEASE_VERSION}"
  fi

  url="https://github.com/${REPO_SLUG}/releases/${release_path}/${asset_name}"
  tmp_dir="$(mktemp -d)"
  trap 'rm -rf "${tmp_dir}"' RETURN

  archive_path="${tmp_dir}/${asset_name}"

  log "Downloading ${asset_name} from ${REPO_SLUG}..."
  if ! curl -fL --retry 3 --connect-timeout 10 -o "${archive_path}" "${url}"; then
    fail "could not download ${asset_name}. If you need source install, follow README instructions."
  fi

  tar -xzf "${archive_path}" -C "${tmp_dir}"
  binary_path="$(find "${tmp_dir}" -type f -name diffx | head -n 1 || true)"
  if [[ -z "${binary_path}" ]]; then
    fail "release archive did not contain a 'diffx' binary"
  fi

  mkdir -p "${LOCAL_BIN_DIR}"
  cp "${binary_path}" "${DIFFX_BIN_PATH}"
  chmod +x "${DIFFX_BIN_PATH}"
}

write_canonical_skill() {
  mkdir -p "${CANONICAL_SKILL_DIR}"
  cat > "${CANONICAL_SKILL_PATH}" <<'MD'
---
name: diffx
description: Launch Diffx interactive review, receive annotation feedback via stdout, and continue implementation in the same Codex thread.
allowed-tools: Bash(diffx:*)
---

# Diffx Review

Use this skill when the user wants interactive annotation-based code review with Diffx and expects feedback to return into the current thread.

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

install_skill_into_target() {
  local target_dir="$1"
  local target_entry="${target_dir}/diffx"
  local backup_path

  mkdir -p "${target_dir}"

  if [[ -L "${target_entry}" ]]; then
    if [[ "$(readlink "${target_entry}")" == "${CANONICAL_SKILL_DIR}" ]]; then
      return
    fi
  fi

  if [[ -e "${target_entry}" || -L "${target_entry}" ]]; then
    backup_path="${target_entry}.backup.$(date +%Y%m%d%H%M%S)"
    mv "${target_entry}" "${backup_path}"
    log "Backed up existing ${target_entry} -> ${backup_path}"
  fi

  if [[ "${USE_SYMLINK}" == "1" ]]; then
    if ln -s "${CANONICAL_SKILL_DIR}" "${target_entry}"; then
      return
    fi
    log "Symlink failed for ${target_entry}; falling back to copy."
  fi

  mkdir -p "${target_entry}"
  cp -R "${CANONICAL_SKILL_DIR}/." "${target_entry}/"
}

is_selected() {
  local id="$1"
  local idx
  idx="$(find_agent_index "$id")"
  if [[ "$idx" == "-1" ]]; then
    echo "0"
    return
  fi
  echo "${SELECTED[idx]}"
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

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --yes)
        ASSUME_YES=1
        shift
        ;;
      --agents)
        AGENTS_CSV="${2:-}"
        [[ -z "${AGENTS_CSV}" ]] && fail "--agents requires a comma-separated value"
        shift 2
        ;;
      --copy)
        USE_SYMLINK=0
        shift
        ;;
      --symlink)
        USE_SYMLINK=1
        shift
        ;;
      --repo)
        REPO_SLUG="${2:-}"
        [[ -z "${REPO_SLUG}" ]] && fail "--repo requires a value"
        shift 2
        ;;
      --version)
        RELEASE_VERSION="${2:-}"
        [[ -z "${RELEASE_VERSION}" ]] && fail "--version requires a value"
        shift 2
        ;;
      --list-agents)
        list_agents
        exit 0
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      *)
        fail "unknown argument: $1"
        ;;
    esac
  done
}

main() {
  parse_args "$@"
  ensure_command curl
  ensure_command tar

  init_default_selection

  if [[ -n "${AGENTS_CSV}" ]]; then
    apply_agents_csv "${AGENTS_CSV}"
  elif [[ "${ASSUME_YES}" == "0" ]]; then
    interactive_agent_selection
  fi

  ensure_selection_present

  download_and_install_binary
  write_canonical_skill

  local i selected_targets=()
  for i in "${!AGENT_IDS[@]}"; do
    if [[ "${SELECTED[i]}" == "1" ]]; then
      install_skill_into_target "${AGENT_PATHS[i]}"
      selected_targets+=("${AGENT_IDS[i]}")
    fi
  done

  if [[ "$(is_selected "claude")" == "1" ]]; then
    write_claude_command
  fi

  cat <<TXT
[install] Done.
[install] Installed binary: ${DIFFX_BIN_PATH}
[install] Canonical skill: ${CANONICAL_SKILL_PATH}
[install] Targets: ${selected_targets[*]}

Use:
  diffx
  diffx review
TXT

  print_path_hint_if_needed
}

main "$@"
