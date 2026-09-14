# Releasing diffx

## Where release code lives

| File | Responsibility |
| --- | --- |
| `.github/workflows/ci.yml` | Checks PRs, pushes to main, manual runs, and release tags through a reusable workflow. |
| `.github/workflows/release.yml` | Waits for checks, then publishes a tagged release. |
| `.goreleaser.yml` | Builds the embedded frontend, cross-compiles binaries, and packages archives/checksums. |
| `scripts/install.sh` | Downloads and installs one platform's binary on the user's machine. |
| `scripts/install_test.go` | Offline installer regression tests. |
| `scripts/smoke-test.py` | Exercises a standalone binary in an isolated repository. |
| `scripts/release/` | Optional maintainer helper for creating version tags; never shipped. |

The application stays in `cmd/diffx`, `internal`, and `frontend`. Only `cmd/diffx` is included in release binaries. Version metadata is injected at build time.

## Test locally without publishing

Install [GoReleaser v2.18.1](https://goreleaser.com/getting-started/install/oss/), the version pinned in both workflows. You also need the development prerequisites listed in [development.md](development.md).

From the repository root:

```sh
goreleaser check
goreleaser release --snapshot --clean
npm --prefix frontend run lint
go test ./cmd/... ./internal/... ./scripts/...
```

The snapshot command runs the frontend build once and creates all four archives plus `SHA256SUMS.txt` in `dist/`. It does not publish, create tags, or require a GitHub token. `--clean` replaces only the generated release output in `dist/`.

Test the actual installer against those local archives, using an isolated destination:

```sh
diffx_test_dir="$(mktemp -d)"
INSTALL_DIR="$diffx_test_dir/bin" bash scripts/install.sh --from-dir "$PWD/dist"
"$diffx_test_dir/bin/diffx" --version
python3 scripts/smoke-test.py "$diffx_test_dir/bin/diffx"
```

For a manual browser check, run the installed executable from a Git repository:

```sh
"$diffx_test_dir/bin/diffx"
```

Confirm the expected repository opens, then press Ctrl+C. To test upgrading, rerun the local installer while the app is running: it replaces the executable by rename, leaving the existing process intact. Restart the app to use the new version. Settings remain in `~/.diffx/config.json`.

## What CI verifies

Linux and macOS jobs build the frontend, lint, run Go/installer tests, and smoke-test a native binary. The Linux job also builds all four release archives and installs/smoke-tests its archive. macOS Intel and Linux ARM64 binaries are cross-compiled but do not currently get native runtime tests.

CI's snapshot build skips GoReleaser's frontend hook because that job already built the UI. The publishing job runs the hook normally. Node 24 is used for frontend builds; the Go version comes from `go.mod`.

## Publish

One-time GitHub setup:

- Use a public repository for anonymous curl downloads (currently `mewtyunjay/diffx-v2`). If the repository changes, update the installer's default and README URLs.
- Enable GitHub Actions and allow the publishing job `contents: write`. It uses GitHub's automatic `GITHUB_TOKEN`; no personal token or custom secret is needed.
- Commit and push the release configuration and app changes before tagging.

For each stable release, choose a new version and push an annotated tag:

```sh
git tag -a v0.1.0 -m "Release v0.1.0"
git push origin v0.1.0
```

Use an unused version, not necessarily the example above. Watch **Actions → Release**. Publishing begins only after the Linux/macOS checks pass. GoReleaser uploads:

```text
diffx_darwin_x86_64.tar.gz
diffx_darwin_arm64.tar.gz
diffx_linux_x86_64.tar.gz
diffx_linux_arm64.tar.gz
SHA256SUMS.txt
install.sh
```

The README's latest-install command becomes available after the first stable release from this pipeline. Normal pushes to main never publish a release.

For an end-to-end GitHub test before a stable release, use an unused prerelease tag such as `v0.1.0-rc.1`. GoReleaser marks it as a prerelease, so it does not replace the latest stable release. Install it explicitly:

```sh
curl -fsSL https://github.com/mewtyunjay/diffx-v2/releases/download/v0.1.0-rc.1/install.sh | env INSTALL_DIR="$HOME/.local/bin" bash -s -- --version v0.1.0-rc.1
```

The optional helper can still preview or create stable version bumps:

```sh
go run ./scripts/release patch --dry-run
```

## Install behavior

The installer resolves `latest` to one specific tag before downloading its archive and checksum. Checksums catch corrupt or mismatched downloads; they are not a separate publisher signature. Extraction and checksum failures preserve the existing executable. It installs into `~/.local/bin` by default, accepts `INSTALL_DIR`, never invokes sudo, and never edits shell startup files, app settings, or agent integrations.

If the install directory is absent from `PATH`, it prints an `export PATH=...` command for Bash/Zsh or `fish_add_path` for Fish. An export affects the current shell; users can add it to their startup file for future shells. If the directory is already on `PATH`, it prints no PATH instructions.

Windows is not included in this release setup.
