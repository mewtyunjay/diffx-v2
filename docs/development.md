# Development

Requirements: Go 1.25 or newer, Node.js 24 LTS with npm, Git, and Python 3 for the standalone smoke test.

From the repository root:

```sh
go generate ./frontend
go run ./cmd/diffx
```

`go generate` installs the locked npm dependencies and produces `frontend/dist`. Go embeds that bundle in the application; distributed binaries do not require Node, Go, or the source checkout.

For frontend hot reload after installing dependencies:

```sh
go run ./cmd/diffx --dev
```

The Go server serves API requests and proxies frontend traffic to Vite. The app opens a browser automatically; use `--no-browser` to disable that.

## Verification

```sh
go generate ./frontend
npm --prefix frontend run lint
go test ./cmd/... ./internal/... ./scripts/...
CGO_ENABLED=0 go build -o /tmp/diffx-dev ./cmd/diffx
python3 scripts/smoke-test.py /tmp/diffx-dev
```

The smoke test uses a temporary home directory and Git repository. It verifies version reporting outside a repository, current-directory selection, the Git API, and the embedded HTML, JavaScript, and CSS, then stops the server and removes its temporary files. It does not open a browser.

`go test ./scripts/...` covers installer behavior and the optional maintainer release helper. Installer tests fake network responses and OS/CPU detection while exercising real archive extraction, checksums, PATH hints, cleanup, and executable replacement.

See [releasing.md](releasing.md) for testing the actual release archives and installer.
