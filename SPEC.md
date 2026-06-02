# Binary-First Install, Homebrew, and Release Cleanup

## Objective

Move `diffx` from a mixed install/setup/release flow to a clean binary-first distribution model.

The end state should be:

- One primary runtime artifact: a self-contained `diffx` binary with embedded frontend assets.
- One simple curl install command for users who do not use a package manager.
- First-class Homebrew install support for macOS and Linuxbrew users.
- Agent setup remains available, but only when explicitly requested.
- Maintainer release/tag logic lives outside the shipped app binary.
- Local source development keeps working exactly as it does now.

## Current State

- The public installer downloads `diffx` into `~/.local/bin/diffx`, then immediately runs `diffx setup`.
- The user-facing `diffx` binary contains maintainer-only release behavior through `diffx release`.
- `.github/workflows/release.yml` hand-rolls cross-platform archives and checksums in shell.
- There is no Homebrew cask or tap publishing.
- `frontend/embed.go` runs `npm install` during `go generate ./frontend`.
- The Go app embeds `frontend/dist`, but Git does not track empty directories. Generated `frontend/dist` output exists locally, while a fresh checkout can still hit `go:embed` directory-shape problems.
- `implementation-notes.md` is tracked scratch history, not app documentation.

## Distribution Model

### Curl Installer

The primary single-command install path should be documented as:

```sh
curl -fsSL https://raw.githubusercontent.com/mewtyunjay/diffx-v2/main/scripts/install.sh | bash
```

Default install location:

```text
~/.local/bin/diffx
```

Rules:

- Do not require `sudo` by default.
- Create `~/.local/bin` if it does not exist.
- Print a PATH hint if `~/.local/bin` is not on `PATH`.
- Support an explicit override for advanced users:

```sh
INSTALL_DIR=/usr/local/bin bash scripts/install.sh
```

- If the chosen install directory is not writable, fail with a clear message instead of silently escalating.
- Default curl install only installs the binary.
- Agent setup runs only when the user passes `--setup`.

### Homebrew

Homebrew should be a supported install channel after this pass.

Target user command:

```sh
brew install --cask mewtyunjay/tap/diffx
```

Implementation target:

- Use GoReleaser Homebrew support.
- Publish or generate a cask named `diffx`.
- Target tap repository: `mewtyunjay/homebrew-tap`.
- The cask must install only the `diffx` binary built from `./cmd/diffx`.
- Homebrew owns the final binary location:
  - Apple Silicon Homebrew usually links into `/opt/homebrew/bin/diffx`.
  - Intel macOS Homebrew usually links into `/usr/local/bin/diffx`.
  - Linuxbrew uses its configured prefix.
- Do not hard-code Homebrew-managed install paths in app code or the curl installer.
- If the tap repo or token is not available during local verification, keep the GoReleaser config ready and document the skipped publish step.

### Unsupported Channels

- Do not add npm or `npx` support in this pass.
- Do not add Electron, Docker, Scoop, Winget, or Linux package repository support in this pass.
- npm/`npx` would require a separate downloader/launcher package and should remain a future decision.

## Frontend Bundle Model

`frontend/dist` is the Vite production build output.

Source files live under:

```text
frontend/src/
```

`go generate ./frontend` builds browser assets into:

```text
frontend/dist/index.html
frontend/dist/assets/*.js
frontend/dist/assets/*.css
```

The released Go binary embeds those generated files so installed users do not need Node, npm, Vite, or a frontend dev server.

Git should track only:

```text
frontend/dist/.keep
```

Purpose of `.keep`:

- Git does not track empty directories.
- Go's `//go:embed all:dist` needs the `dist` directory to exist at compile time.
- `.keep` preserves the directory shape in fresh checkouts.
- Generated `index.html` and `assets/*` stay ignored and must not be committed.

## Local Development Must Stay

Do not remove or degrade these workflows:

```sh
go run ./cmd/diffx --dev
```

Fast live loop. Go serves `/api`; Vite serves the frontend with HMR.

```sh
go generate ./frontend
go run ./cmd/diffx
```

Production-path local test. Builds `frontend/dist`, then runs the Go server against embedded/local production assets.

```sh
go generate ./frontend
go build -o /tmp/diffx ./cmd/diffx
/tmp/diffx --no-browser
```

Binary smoke test. Closest local check to the released artifact.

## In Scope

1. Move release command out of the app binary.
   - Remove the `release` dispatch from `cmd/diffx/main.go`.
   - Move existing release logic and tests from `cmd/diffx/release.go` and `cmd/diffx/release_test.go` into a maintainer-only command, preferably `cmd/diffx-release`.
   - The maintainer workflow should be `go run ./cmd/diffx-release patch`, `minor`, `major`, or an explicit version.
   - Do not include `cmd/diffx-release` in public release archives or the Homebrew cask.

2. Replace hand-written release packaging with GoReleaser.
   - Add `.goreleaser.yml`.
   - Configure GoReleaser to build only `./cmd/diffx`.
   - Preserve or intentionally update archive names used by `scripts/install.sh`.
   - Publish checksums through GoReleaser.
   - Add Homebrew cask generation/publishing for `mewtyunjay/homebrew-tap`.
   - Update `.github/workflows/release.yml` to build the frontend first, then run GoReleaser.

3. Make frontend generation deterministic.
   - Change `frontend/embed.go` from `npm install` to `npm ci`.
   - Add tracked `frontend/dist/.keep`.
   - Confirm `frontend/.gitignore` keeps generated `frontend/dist/index.html` and `frontend/dist/assets/*` ignored.

4. Make the curl installer binary-only by default.
   - Keep `scripts/install.sh`.
   - Default install location is `${INSTALL_DIR:-$HOME/.local/bin}/diffx`.
   - Default behavior installs only the binary and prints a PATH hint.
   - Add `--setup` to run `diffx setup` after installation.
   - Setup-specific flags such as `--agents`, `--copy`, `--symlink`, `--list-agents`, and setup-oriented `--yes` must require `--setup` or fail with a clear message.
   - Update usage text and README examples.

5. Verify installer checksums.
   - Download the GoReleaser checksum file for the selected release.
   - Verify the downloaded archive before extraction.
   - Support macOS and Linux checksum tools (`shasum -a 256` and/or `sha256sum`).
   - Fail before installing if checksum verification fails.

6. Add Homebrew documentation.
   - README should show:

```sh
brew install --cask mewtyunjay/tap/diffx
```

   - Explain that Homebrew controls the install prefix.
   - Keep curl install as the universal one-command option.

7. Clean stale tracked notes.
   - Delete tracked `implementation-notes.md`.
   - Do not touch untracked `possible-upgrades.md` unless the user explicitly asks.

8. Update repository docs.
   - README install section should show Homebrew and curl install.
   - README should show optional agent setup separately.
   - README development section should keep `go run ./cmd/diffx --dev`, `go generate ./frontend && go run ./cmd/diffx`, and binary smoke-test commands.
   - `docs/release-and-local-dev.md`, if kept, must describe the new maintainer release command and source-build shortcut accurately.
   - AGENTS.md command descriptions should mention `npm ci` for `go generate ./frontend`.
   - Add a short security note near address/port docs: binding to `0.0.0.0` exposes write-capable git API endpoints and is not a supported sharing mode without auth.

## Out of Scope

- Do not remove real product agent features:
  - `diffx setup`
  - review mode
  - `/api/feedback`
  - "Send to agent"
  - AI agent/provider detection for commit-message generation
- Do not add npm or `npx` support.
- Do not switch the app to Electron, Docker, or npm-first distribution.
- Do not commit full generated frontend build assets.
- Do not implement live network sharing, auth tokens, read-only sessions, or permission modes in this pass.
- Do not refactor unrelated diff viewer, git action, or AI provider code.

## Implementation Checklist

- [ ] Inspect current release/install/frontend files before editing:
  - `cmd/diffx/main.go`
  - `cmd/diffx/release.go`
  - `cmd/diffx/release_test.go`
  - `.github/workflows/release.yml`
  - `scripts/install.sh`
  - `frontend/embed.go`
  - `frontend/.gitignore`
  - `README.md`
  - `AGENTS.md`
  - `docs/release-and-local-dev.md`
- [ ] Create maintainer-only release command under `cmd/diffx-release`.
- [ ] Remove release handling from the shipped `cmd/diffx` command.
- [ ] Add GoReleaser config for archives, checksums, and Homebrew casks.
- [ ] Update the release workflow to use GoReleaser.
- [ ] Switch frontend generation to `npm ci`.
- [ ] Add `frontend/dist/.keep`.
- [ ] Make installer default to binary-only install at `${INSTALL_DIR:-$HOME/.local/bin}/diffx`.
- [ ] Add installer checksum verification.
- [ ] Add `--setup` opt-in for agent setup.
- [ ] Update docs to match actual install, Homebrew, setup, and release behavior.
- [ ] Delete `implementation-notes.md`.
- [ ] Run validation commands and fix failures.

## Finish Criteria

The pass is complete only when all of these are true:

- `go run ./cmd/diffx release patch` no longer works because release is not part of the user-facing app binary.
- `go run ./cmd/diffx-release patch --dry-run` works from a git checkout and reports the tag it would create.
- `.github/workflows/release.yml` delegates archive/checksum publishing to GoReleaser.
- `.goreleaser.yml` builds the app binary from `./cmd/diffx` and does not ship the maintainer release command.
- `.goreleaser.yml` contains Homebrew cask support for `mewtyunjay/homebrew-tap`.
- README documents `brew install --cask mewtyunjay/tap/diffx`.
- README documents the curl one-command installer.
- `scripts/install.sh` installs to `${INSTALL_DIR:-$HOME/.local/bin}/diffx`.
- `scripts/install.sh` installs only the binary by default.
- `scripts/install.sh --setup` installs the binary and then runs `diffx setup`.
- Installer downloads and verifies the checksum before extracting the archive.
- `go generate ./frontend` uses `npm ci`.
- `frontend/dist/.keep` is tracked, and generated `frontend/dist` build outputs remain ignored.
- README and local release docs match the final commands.
- `implementation-notes.md` is removed.
- Existing app behavior still works for local dev and production-path local testing.

## Testing and Verification

Run these from the repository root unless noted.

Required code verification:

```sh
cd frontend && npm run lint
go generate ./frontend
go test ./cmd/... ./internal/...
```

Required maintainer-command verification:

```sh
go run ./cmd/diffx-release patch --dry-run
go run ./cmd/diffx release patch
```

Expected result:

- The first command succeeds without creating a tag.
- The second command fails because `release` is no longer a `diffx` subcommand.

Required binary smoke test:

```sh
go generate ./frontend
go build -o /tmp/diffx ./cmd/diffx
/tmp/diffx --no-browser
```

Expected result:

- The binary starts the local server.
- It serves embedded frontend assets.
- This is a manual smoke test because the server keeps running; stop it after confirming startup output.

Required safe installer checks:

```sh
bash -n scripts/install.sh
bash scripts/install.sh --help
tmp_home="$(mktemp -d)"
HOME="${tmp_home}" INSTALL_DIR="${tmp_home}/bin" bash scripts/install.sh --help
```

Expected result:

- Help text shows binary-only default behavior, `${INSTALL_DIR:-$HOME/.local/bin}`, and explicit `--setup`.
- The shell script parses without syntax errors.

Required live installer checks, when release assets are available:

```sh
tmp_home="$(mktemp -d)"
HOME="${tmp_home}" bash scripts/install.sh --version latest --repo mewtyunjay/diffx-v2
HOME="${tmp_home}" bash scripts/install.sh --setup --version latest --repo mewtyunjay/diffx-v2 --yes --agents universal
```

Expected result:

- Binary-only install writes `diffx` under `${tmp_home}/.local/bin/diffx` and does not run `diffx setup`.
- Setup install runs `diffx setup` only when `--setup` is present.
- These commands require network access and current release assets; document the skip reason if they cannot run.

Required release config checks:

```sh
goreleaser check
goreleaser release --snapshot --clean
```

Expected result:

- GoReleaser config validates.
- Snapshot build produces archives and checksum files without publishing.
- Snapshot build includes or renders the Homebrew cask configuration without publishing to the tap.
- These commands may require installing GoReleaser; document the skip reason if it is unavailable.

Fresh checkout invariant:

```sh
git clean -ndX frontend/dist
# If the dry run lists only ignored generated frontend build assets, then run:
git clean -fdX frontend/dist
go test ./cmd/... ./internal/...
```

Expected result:

- Ignored generated frontend assets are not required to be committed.
- The tracked `frontend/dist/.keep` keeps Go embed compilation from failing before generation.

## Notes for the `/goal` Runner

- Treat curl install, Homebrew install, and maintainer release as separate workflows.
- Preserve current local development ergonomics.
- Prefer small, direct file moves over broad refactors.
- Keep the release-command tests by moving them with the maintainer command instead of deleting coverage.
- Do not remove any user-facing agent or review features just because they mention agents.
- Do not add npm or `npx` support during this pass.
- Before finalizing, inspect `git status --short` and make sure untracked `possible-upgrades.md` was not modified or deleted.
