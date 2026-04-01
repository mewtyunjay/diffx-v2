# diffx-v2

## Installable CLI

This repo can now be published as an npm CLI named `diffx`.

- Install globally: `npm install -g diffx`
- Run in the current directory: `diffx`
- Run against another folder: `diffx path/to/folder`
- Prevent auto-open: `diffx --no-open`

`diffx` expects the target directory to be inside a git repository. When the target is a nested folder, the UI is scoped to that subtree while git operations still resolve against the repo root.

## Development

- Build the developer CLI at repo root: `go build -o cli ./cmd/cli`
- Install dependencies: `./cli install`
- Start the full dev environment: `./cli dev`
- Build frontend + backend: `./cli build`
- Build npm package assets: `./cli package`
- Test npm CLI helpers: `npm run test:cli`

## Fallback Commands

- Frontend only: `cd frontend && npm run dev`
- Backend only: `go run ./cmd/server`
- Backend with hot reload only: `go run ./cmd/dev`
