# diffx-v2

`diffx` is a local git diff review app for working with changes in a git repository. It gives you a browser UI for reviewing files, switching comparison branches, staging and unstaging changes, and creating commits.

## Quick Start

Install frontend dependencies first:

```sh
cd frontend && npm install
```

`go run ./cmd/diffx` does not run `npm install` for you in dev mode.

Start the app from the repository root:

```sh
go run ./cmd/diffx
```

Open the URL printed by `diffx`. By default it starts on `http://127.0.0.1:8080`, and if `8080` is already occupied it will automatically move to the next free port.

## Common Commands

Run the app (serves embedded frontend assets):

```sh
go run ./cmd/diffx
```

Start with the Vite dev server for frontend development:

```sh
go run ./cmd/diffx --dev
```

Change the address or port:

```sh
go run ./cmd/diffx -a 0.0.0.0 -p 9000
go run ./cmd/diffx --address 0.0.0.0 --port 9000
```

If you explicitly pass `--port` or `-p`, that port remains strict and `diffx` will fail instead of auto-selecting another port.

## Build

```sh
go generate ./frontend
go build ./cmd/diffx
```

`go generate ./frontend` installs frontend dependencies and builds the frontend bundle before you build the Go binary.

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
