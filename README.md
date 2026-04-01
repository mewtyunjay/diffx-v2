# diffx-v2

`diffx` is a Go application that serves a local git diff review UI from a single binary. The React frontend is built with Vite and embedded into the Go server at build time.

## Development

Install frontend dependencies once:

```sh
cd frontend && npm install
```

Run the frontend dev server against the Go API:

```sh
cd frontend && npm run dev
go run ./cmd/diffx
```

You can also scope the app to a nested folder inside a git repo:

```sh
go run ./cmd/diffx ./frontend
```

If `frontend/dist/` has not been built into the current binary yet, `go run ./cmd/diffx` will build the local frontend bundle automatically when `frontend/node_modules` is present.

## Production Build

Build the embedded frontend bundle first, then build the Go binary:

```sh
cd frontend && npm run build
go build ./cmd/diffx
```

The binary serves the embedded UI and API on `http://127.0.0.1:8080` by default.

## Verification

For relevant changes, run:

```sh
cd frontend && npm run lint
cd frontend && npm run build
go test ./cmd/... ./internal/...
```
