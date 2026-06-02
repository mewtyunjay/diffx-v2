# diffx-v2

`diffx` is a local git diff review app for working with changes in a git repository. It gives you a browser UI for reviewing files, switching comparison branches, staging and unstaging changes, and creating commits.

## Install

### Homebrew

```sh
brew install --cask mewtyunjay/tap/diffx
```

Homebrew owns the install prefix. On Apple Silicon macOS this usually links `diffx` into `/opt/homebrew/bin/diffx`; on Intel macOS this is usually `/usr/local/bin/diffx`; Linuxbrew uses its configured prefix.

### Curl Installer (macOS/Linux)

```sh
curl -fsSL https://raw.githubusercontent.com/mewtyunjay/diffx-v2/main/scripts/install.sh | bash
```

The installer downloads the latest prebuilt `diffx` binary, verifies `SHA256SUMS.txt`, and installs to `~/.local/bin/diffx` by default.

Use `INSTALL_DIR` to choose another writable install directory:

```sh
INSTALL_DIR=/usr/local/bin bash scripts/install.sh
```

Use `--version <tag>` to pin the installer to a specific release instead of `latest`.

After install:

```sh
diffx
diffx review
```

If `~/.local/bin` is not on your `PATH`, the installer prints exact copy-paste commands for your shell.

### Optional Agent Setup

Agent skill setup is explicit. Run it after installing the binary:

```sh
diffx setup
diffx setup --list-agents
diffx setup --yes --agents universal,claude,codex
```

The curl installer can run setup after binary installation when requested:

```sh
curl -fsSL https://raw.githubusercontent.com/mewtyunjay/diffx-v2/main/scripts/install.sh | bash -s -- --setup --yes --agents universal,claude
```

### Install from Source

Prerequisites:

- Go `1.25+`
- Node.js `20+`
- npm

Build and install the binary:

```sh
git clone https://github.com/mewtyunjay/diffx-v2.git
cd diffx-v2
go generate ./frontend
mkdir -p "$HOME/.local/bin"
go build -o "$HOME/.local/bin/diffx" ./cmd/diffx
chmod +x "$HOME/.local/bin/diffx"
```

If needed, add local bin to PATH:

```sh
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

## Quick Start

If you are developing from a source checkout instead of installing the binary, install frontend dependencies first:

```sh
cd frontend && npm ci
```

`go run ./cmd/diffx --dev` does not run `npm ci` for you before starting Vite.

Start the app from the repository root:

```sh
go run ./cmd/diffx
```

## Running

### Development (HMR)

```sh
go run ./cmd/diffx --dev
```

Starts the Go server and proxies frontend requests to a Vite dev server. Frontend changes reflect instantly via hot module reload without rebuilding.

### Agent review mode (stdout handoff)

```sh
go run ./cmd/diffx review
# or
diffx review
```

This starts the same diff UI but enables `/api/feedback` for plannotator-style handoff.  
Use **Send to agent** in the header after annotating. `diffx` prints the submitted feedback to stdout and exits so the calling agent can continue in chat.

By default, `diffx` opens the review URL in your browser automatically.  
Use `--no-browser` to disable browser launch and `--review-timeout 30m` (or another duration) to limit how long review mode waits for feedback.

### Production build

```sh
go generate ./frontend
go build -o diffx ./cmd/diffx
```

`go generate ./frontend` runs `npm ci` and bundles the frontend into `frontend/dist/`. `go build` then embeds that bundle into the binary.

For quick local runs without creating a binary, `go run ./cmd/diffx` also works — it auto-builds the frontend if the bundle is missing.

To smoke-test the release path without replacing your installed binary:

```sh
go generate ./frontend
go build -o /tmp/diffx ./cmd/diffx
/tmp/diffx --no-browser
```

### Address and port

```sh
go run ./cmd/diffx -a 0.0.0.0 -p 9000
go run ./cmd/diffx --address 0.0.0.0 --port 9000
```

If you explicitly pass `--port` or `-p`, that port remains strict and `diffx` will fail instead of auto-selecting another port.

Binding to `0.0.0.0` exposes write-capable git API endpoints such as stage, unstage, commit, push, pull, and checkout. Do not treat this as a supported sharing mode without a private tunnel or future auth/read-only controls.

## Development

Run the frontend dev server directly if needed:

```sh
cd frontend && npm run dev
```

Run frontend linting:

```sh
cd frontend && npm run lint
```

Run backend tests:

```sh
go test ./cmd/... ./internal/...
```

## Verification

For relevant changes, run:

```sh
cd frontend && npm run lint
go generate ./frontend
go test ./cmd/... ./internal/...
```
