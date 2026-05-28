#!/usr/bin/env bash
set -euo pipefail

REPO_SLUG_DEFAULT="mewtyunjay/diffx-v2"
RELEASE_VERSION_DEFAULT="latest"

LOCAL_BIN_DIR="${HOME}/.local/bin"
DIFFX_BIN_PATH="${LOCAL_BIN_DIR}/diffx"

REPO_SLUG="${REPO_SLUG_DEFAULT}"
RELEASE_VERSION="${RELEASE_VERSION_DEFAULT}"

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
  --repo <owner/repo>     GitHub repo slug (default: mewtyunjay/diffx-v2)
  --version <tag|latest>  Release version to install (default: latest)
  -h, --help              Show this help
TXT
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
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

ensure_command() {
  local command_name="$1"
  if ! command -v "${command_name}" >/dev/null 2>&1; then
    fail "missing required command: ${command_name}"
  fi
}

resolve_platform() {
  local uname_s uname_m os arch
  uname_s="$(uname -s)"
  uname_m="$(uname -m)"

  case "${uname_s}" in
    Darwin) os="darwin" ;;
    Linux) os="linux" ;;
    *) fail "unsupported OS: ${uname_s} (supported: macOS, Linux)" ;;
  esac

  case "${uname_m}" in
    x86_64|amd64) arch="x86_64" ;;
    arm64|aarch64) arch="arm64" ;;
    *) fail "unsupported architecture: ${uname_m} (supported: x86_64, arm64)" ;;
  esac

  echo "${os} ${arch}"
}

download_and_install_binary() {
  local os arch asset_name release_path url temp_dir archive_path binary_path
  read -r os arch <<<"$(resolve_platform)"

  asset_name="diffx_${os}_${arch}.tar.gz"
  if [[ "${RELEASE_VERSION}" == "latest" ]]; then
    release_path="latest/download"
  else
    release_path="download/${RELEASE_VERSION}"
  fi

  url="https://github.com/${REPO_SLUG}/releases/${release_path}/${asset_name}"
  temp_dir="$(mktemp -d)"
  trap 'rm -rf "${temp_dir}"' RETURN
  archive_path="${temp_dir}/${asset_name}"

  log "Downloading ${asset_name} from ${REPO_SLUG}..."
  if ! curl -fL --retry 3 --connect-timeout 10 -o "${archive_path}" "${url}"; then
    fail "could not download ${asset_name}. If you need source install, follow README instructions."
  fi

  tar -xzf "${archive_path}" -C "${temp_dir}"
  binary_path="$(find "${temp_dir}" -type f -name diffx | head -n 1 || true)"
  [[ -z "${binary_path}" ]] && fail "release archive did not contain a 'diffx' binary"

  mkdir -p "${LOCAL_BIN_DIR}"
  cp "${binary_path}" "${DIFFX_BIN_PATH}"
  chmod +x "${DIFFX_BIN_PATH}"
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
  parse_args "$@"
  ensure_command curl
  ensure_command tar

  download_and_install_binary

  cat <<TXT
[install] Done.
[install] Installed binary: ${DIFFX_BIN_PATH}

Use:
  diffx
  diffx review
TXT

  print_path_hint_if_needed
}

main "$@"
