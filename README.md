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

Open `http://127.0.0.1:8080`.

By default, running from a source checkout also starts or reuses the frontend dev server so UI changes reload automatically while you work.

## Common Commands

Run the app:

```sh
go run ./cmd/diffx
```


Force the built frontend instead of dev mode:

```sh
go run ./cmd/diffx --static
```

Change the address or port:

```sh
go run ./cmd/diffx -a 0.0.0.0 -p 9000
go run ./cmd/diffx --address 0.0.0.0 --port 9000
```

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
