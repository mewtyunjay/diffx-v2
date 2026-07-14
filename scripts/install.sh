#!/usr/bin/env bash
set -euo pipefail

REPO_SLUG_DEFAULT="mewtyunjay/diffx-v2"
RELEASE_VERSION_DEFAULT="latest"

INSTALL_DIR="${INSTALL_DIR:-${HOME}/.local/bin}"
DIFFX_BIN_PATH="${INSTALL_DIR}/diffx"

RUN_SETUP=0
ASSUME_YES=0
USE_SYMLINK=1
LIST_AGENTS=0
AGENTS_CSV=""
SETUP_ARGS_USED=0
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
  --setup                 Run `diffx setup` after installing the binary
  --yes                   Setup only: run setup non-interactively
  --agents <csv>          Setup only: comma-separated agent IDs
  --copy                  Setup only: copy skill files instead of symlinking
  --symlink               Setup only: symlink skill files (default)
  --list-agents           Setup only: print curated agent targets after install
  -h, --help              Show this help

Environment:
  INSTALL_DIR             Install directory (default: $HOME/.local/bin)
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
      --setup)
        RUN_SETUP=1
        shift
        ;;
      --yes)
        ASSUME_YES=1
        SETUP_ARGS_USED=1
        shift
        ;;
      --agents)
        AGENTS_CSV="${2:-}"
        [[ -z "${AGENTS_CSV}" ]] && fail "--agents requires a comma-separated value"
        SETUP_ARGS_USED=1
        shift 2
        ;;
      --copy)
        USE_SYMLINK=0
        SETUP_ARGS_USED=1
        shift
        ;;
      --symlink)
        USE_SYMLINK=1
        SETUP_ARGS_USED=1
        shift
        ;;
      --list-agents)
        LIST_AGENTS=1
        SETUP_ARGS_USED=1
        shift
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

  if [[ "${RUN_SETUP}" == "0" && "${SETUP_ARGS_USED}" == "1" ]]; then
    fail "setup flags require --setup"
  fi
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

ensure_install_dir() {
  if ! mkdir -p "${INSTALL_DIR}"; then
    fail "could not create install directory: ${INSTALL_DIR}"
  fi
  if [[ ! -w "${INSTALL_DIR}" ]]; then
    fail "install directory is not writable: ${INSTALL_DIR}. Set INSTALL_DIR to a writable directory."
  fi
}

checksum_for_file() {
  local file_path="$1"

  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "${file_path}" | awk '{print $1}'
    return
  fi
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "${file_path}" | awk '{print $1}'
    return
  fi

  fail "missing checksum command: install sha256sum or shasum"
}

verify_archive_checksum() {
  local asset_name="$1"
  local archive_path="$2"
  local checksum_path="$3"
  local expected actual

  expected="$(awk -v file="${asset_name}" '{ name = $2; sub(/^.*\//, "", name); if (name == file) { print $1; exit } }' "${checksum_path}")"
  [[ -z "${expected}" ]] && fail "checksum file did not contain ${asset_name}"

  actual="$(checksum_for_file "${archive_path}")"
  if [[ "${actual}" != "${expected}" ]]; then
    fail "checksum verification failed for ${asset_name}"
  fi
}

download_and_install_binary() {
  local os arch asset_name release_path url checksum_url temp_dir archive_path checksum_path binary_path
  read -r os arch <<<"$(resolve_platform)"

  asset_name="diffx_${os}_${arch}.tar.gz"
  if [[ "${RELEASE_VERSION}" == "latest" ]]; then
    release_path="latest/download"
  else
    release_path="download/${RELEASE_VERSION}"
  fi

  url="https://github.com/${REPO_SLUG}/releases/${release_path}/${asset_name}"
  checksum_url="https://github.com/${REPO_SLUG}/releases/${release_path}/SHA256SUMS.txt"
  temp_dir="$(mktemp -d)"
  trap 'rm -rf "${temp_dir:-}"; trap - RETURN' RETURN
  archive_path="${temp_dir}/${asset_name}"
  checksum_path="${temp_dir}/SHA256SUMS.txt"

  log "Downloading ${asset_name} from ${REPO_SLUG}..."
  if ! curl -fL --retry 3 --connect-timeout 10 -o "${archive_path}" "${url}"; then
    fail "could not download ${asset_name}. If you need source install, follow README instructions."
  fi
  log "Downloading SHA256SUMS.txt..."
  if ! curl -fL --retry 3 --connect-timeout 10 -o "${checksum_path}" "${checksum_url}"; then
    fail "could not download SHA256SUMS.txt for checksum verification"
  fi

  verify_archive_checksum "${asset_name}" "${archive_path}" "${checksum_path}"

  tar -xzf "${archive_path}" -C "${temp_dir}"
  binary_path="$(find "${temp_dir}" -type f -name diffx | head -n 1 || true)"
  [[ -z "${binary_path}" ]] && fail "release archive did not contain a 'diffx' binary"

  cp "${binary_path}" "${DIFFX_BIN_PATH}"
  chmod +x "${DIFFX_BIN_PATH}"
}

run_diffx_setup() {
  local setup_args=()

  if [[ "${LIST_AGENTS}" == "1" ]]; then
    setup_args+=(--list-agents)
  fi
  if [[ "${ASSUME_YES}" == "1" ]]; then
    setup_args+=(--yes)
  fi
  if [[ -n "${AGENTS_CSV}" ]]; then
    setup_args+=(--agents "${AGENTS_CSV}")
  fi
  if [[ "${USE_SYMLINK}" == "0" ]]; then
    setup_args+=(--copy)
  fi

  "${DIFFX_BIN_PATH}" setup "${setup_args[@]}"
}

print_path_hint_if_needed() {
  if [[ ":${PATH}:" != *":${INSTALL_DIR}:"* ]]; then
    echo ""
    cat <<TXT
You may need to restart your shell to gain access to the 'diffx' command.
Alternatively, add ${INSTALL_DIR} to your PATH:
    export PATH="${INSTALL_DIR}:\$PATH"
TXT
  fi
}

main() {
  parse_args "$@"
  ensure_command curl
  ensure_command tar
  ensure_install_dir

  download_and_install_binary
  if [[ "${RUN_SETUP}" == "1" ]]; then
    run_diffx_setup
  fi

  cat <<TXT
[install] Done.
[install] Installed binary: ${DIFFX_BIN_PATH}

Use:
  diffx
  diffx review
  diffx setup
TXT

  print_path_hint_if_needed
}

main "$@"
