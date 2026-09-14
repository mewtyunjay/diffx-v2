#!/usr/bin/env bash
set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-${HOME}/.local/bin}"
REPO_SLUG="mewtyunjay/diffx-v2"
VERSION="latest"
FROM_DIR=""
TEMP_DIR=""
STAGED_BINARY=""

fail() { printf '[install] error: %s\n' "$*" >&2; exit 1; }
log() { printf '[install] %s\n' "$*"; }

cleanup() {
  [[ -z "$TEMP_DIR" ]] || rm -rf "$TEMP_DIR"
  [[ -z "$STAGED_BINARY" ]] || rm -f "$STAGED_BINARY"
  return 0
}

usage() {
  cat <<'TXT'
Install diffx for macOS or Linux (x86-64 or ARM64).

Usage: bash install.sh [options]
  --version <tag>      Install a specific version, e.g. v0.1.0 (default: latest)
  --repo <owner/repo>  Download from another GitHub repository
  --from-dir <dir>    Install local release archives and SHA256SUMS.txt (no download)
  -h, --help          Show help

Environment:
  INSTALL_DIR         Destination (default: $HOME/.local/bin)

Rerun to upgrade. Shell configuration, app settings, and agent setup are untouched.
TXT
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --version|--repo|--from-dir)
        [[ $# -ge 2 && -n "$2" && "$2" != --* ]] || fail "$1 requires a value"
        case "$1" in
          --version) VERSION="$2" ;;
          --repo) REPO_SLUG="$2" ;;
          --from-dir) FROM_DIR="$2" ;;
        esac
        shift 2
        ;;
      -h|--help) usage; exit 0 ;;
      *) fail "unknown option: $1 (see --help)" ;;
    esac
  done
  [[ "$REPO_SLUG" =~ ^[a-zA-Z0-9_.-]+/[a-zA-Z0-9_.-]+$ ]] || fail "invalid repository: $REPO_SLUG"
  if [[ -n "$FROM_DIR" && "$VERSION" != latest ]]; then
    fail "--from-dir cannot be combined with --version"
  fi
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "missing required command: $1"
}

resolve_platform() {
  local os arch
  case "$(uname -s)" in
    Darwin) os=darwin ;;
    Linux) os=linux ;;
    *) fail "unsupported OS (supported: macOS and Linux)" ;;
  esac
  case "$(uname -m)" in
    x86_64|amd64) arch=x86_64 ;;
    arm64|aarch64) arch=arm64 ;;
    *) fail "unsupported CPU (supported: x86-64 and ARM64)" ;;
  esac
  printf 'diffx_%s_%s.tar.gz\n' "$os" "$arch"
}

fetch() {
  curl --proto '=https' --proto-redir '=https' -fsSL --retry 3 \
    --connect-timeout 10 --max-time 300 "$@"
}

resolve_version() {
  if [[ "$VERSION" == latest ]]; then
    local release_url
    # Resolve once so a release published mid-install cannot mix archive/checksum versions.
    release_url="$(fetch -o /dev/null -w '%{url_effective}' "https://github.com/$REPO_SLUG/releases/latest")" \
      || fail "could not find a published release in $REPO_SLUG"
    [[ "$release_url" == "https://github.com/$REPO_SLUG/releases/tag/"* ]] \
      || fail "unexpected latest release URL: $release_url"
    VERSION="${release_url##*/}"
  fi
  [[ "$VERSION" =~ ^v[0-9]+\.[0-9]+\.[0-9]+([+-][a-zA-Z0-9.+-]+)?$ ]] \
    || fail "invalid version: $VERSION (expected a tag such as v0.1.0)"
}

verify_checksum() {
  local asset="$1" expected actual
  expected="$(awk -v name="$asset" '$2 == name { print $1 }' "$TEMP_DIR/SHA256SUMS.txt")"
  [[ "$expected" =~ ^[a-fA-F0-9]{64}$ ]] || fail "missing or invalid checksum for $asset"
  if command -v sha256sum >/dev/null 2>&1; then
    actual="$(sha256sum "$TEMP_DIR/$asset" | awk '{print $1}')"
  else
    require_command shasum
    actual="$(shasum -a 256 "$TEMP_DIR/$asset" | awk '{print $1}')"
  fi
  [[ "$actual" == "$expected" ]] || fail "checksum verification failed for $asset"
}

print_path_hint() {
  [[ ":$PATH:" != *":$INSTALL_DIR:"* ]] || return 0
  local quoted_dir
  # Single-quote literal paths, including spaces, dollars, and embedded apostrophes.
  quoted_dir="'${INSTALL_DIR//\'/\'\\\'\'}'"
  printf '\n%s\n' 'diffx is not on PATH. Run this in your shell:'
  case "${SHELL##*/}" in
    fish) printf '  fish_add_path %s\n' "$quoted_dir" ;;
    *)
      printf '  export PATH=%s:"$PATH"\n' "$quoted_dir"
      printf '%s\n' 'For future terminals, add that line to your shell startup file.'
      ;;
  esac
}

main() {
  parse_args "$@"
  local asset base_url
  asset="$(resolve_platform)" || exit 1
  require_command tar
  require_command awk
  TEMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/diffx-install.XXXXXXXX")"
  trap cleanup EXIT
  trap 'exit 130' INT
  trap 'exit 143' TERM

  if [[ -n "$FROM_DIR" ]]; then
    log "Installing local archive $asset"
    cp "$FROM_DIR/$asset" "$TEMP_DIR/$asset" || fail "could not read local archive"
    cp "$FROM_DIR/SHA256SUMS.txt" "$TEMP_DIR/SHA256SUMS.txt" || fail "could not read local checksums"
  else
    require_command curl
    resolve_version
    base_url="https://github.com/$REPO_SLUG/releases/download/$VERSION"
    log "Downloading diffx $VERSION ($asset)"
    fetch -o "$TEMP_DIR/$asset" "$base_url/$asset" || fail "could not download $asset"
    fetch -o "$TEMP_DIR/SHA256SUMS.txt" "$base_url/SHA256SUMS.txt" || fail "could not download checksums"
  fi
  verify_checksum "$asset"

  mkdir -p "$INSTALL_DIR" || fail "could not create $INSTALL_DIR; set INSTALL_DIR to a writable directory"
  INSTALL_DIR="$(cd "$INSTALL_DIR" && pwd -P)"
  [[ ! -d "$INSTALL_DIR/diffx" ]] || fail "$INSTALL_DIR/diffx is a directory"
  STAGED_BINARY="$(mktemp "$INSTALL_DIR/.diffx.XXXXXXXX")"
  # Extract only the executable to stdout; archive entries cannot write arbitrary paths.
  tar -xOzf "$TEMP_DIR/$asset" diffx > "$STAGED_BINARY" || fail "archive does not contain diffx"
  [[ -s "$STAGED_BINARY" ]] || fail "archive contains an empty executable"
  chmod 755 "$STAGED_BINARY"
  # Rename on the same filesystem: existing/running binaries are never truncated.
  mv -f "$STAGED_BINARY" "$INSTALL_DIR/diffx"
  STAGED_BINARY=""

  log "Installed $INSTALL_DIR/diffx"
  log 'Run diffx from your Git repository to open it in your browser.'
  if ! command -v git >/dev/null 2>&1; then
    log 'Git is required to use diffx. Install Git before starting the app.'
  fi
  print_path_hint
}

main "$@"
