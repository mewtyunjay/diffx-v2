# diffx-v2

`diffx` is a Go application that serves a local git diff review UI from a single binary. The React frontend is built with Vite and embedded into the Go server at build time.

## Development

Install frontend dependencies once:

```sh
cd frontend && npm install
```

Run the Go app in source-checkout dev mode:

```sh
go run ./cmd/diffx
```

From the repo checkout, `go run ./cmd/diffx` now starts or reuses the Vite dev server and proxies frontend traffic through Go, so UI edits use HMR by default.

Force the current static-bundle behavior with:

```sh
go run ./cmd/diffx --static
```

You can also scope the app to a nested folder inside a git repo:

```sh
go run ./cmd/diffx ./frontend
```

If static mode is active and `frontend/dist/` has not been built into the current binary yet, `go run ./cmd/diffx --static` will build the local frontend bundle automatically when `frontend/node_modules` is present.

## Production Build

Build the embedded frontend bundle first, then build the Go binary:

```sh
go generate ./frontend
go build ./cmd/diffx
```

`go generate ./frontend` is now the one-shot frontend prep step. It runs `npm install` and then `npm run build` from the `frontend/` package directory before you build the Go binary.

The binary serves the embedded UI and API on `http://127.0.0.1:8080` by default.

You can override the bind address and port:

```sh
go run ./cmd/diffx -a 0.0.0.0 -p 9000
go run ./cmd/diffx --address 0.0.0.0 --port 9000
```

## Verification

For relevant changes, run:

```sh
cd frontend && npm run lint
go generate ./frontend
go test ./cmd/... ./internal/...
```
