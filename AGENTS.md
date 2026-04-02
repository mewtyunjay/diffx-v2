# Repository Guidelines

## Project Structure & Module Organization
This repository has three primary areas:

- `cmd/diffx/`: the Go application entrypoint. It resolves the target workspace and serves the embedded UI plus API.
- `internal/server/`: HTTP routing, JSON handlers, and SPA/static asset serving.
- `internal/gitstatus/`: git-aware backend logic for branches, changed files, and file diffs.
- `frontend/`: Vite + React 19 + TypeScript UI. App entry is `frontend/src/main.tsx`, with page composition in `frontend/src/App.tsx`.
- `frontend/src/components/`: shared UI and layout components. Low-level primitives live in `frontend/src/components/ui/`.
- `frontend/src/app/`: app-specific data and feature folders.
- `frontend/src/lib/`: reusable helpers.

## Build, Test, and Development Commands
Run commands from the relevant package directory.

- `cd frontend && npm install`: install frontend dependencies.
- `cd frontend && npm run dev`: start the Vite dev server manually when needed.
- `go run ./cmd/diffx`: start the Go API on `:8080` and, from a source checkout, start or reuse the Vite dev server with HMR.
- `go run ./cmd/diffx ./frontend`: scope the app to a nested folder inside the current git repository.
- `go generate ./frontend`: run the frontend package's `//go:generate` steps (`npm install`, then `npm run build`) and produce the production bundle in `frontend/dist/`.
- `go run ./cmd/diffx --static` forces the built frontend bundle path and will automatically build `frontend/dist/` locally if the embedded bundle is just the placeholder and `frontend/node_modules` already exists.
- `go build ./cmd/diffx`: build the single Go binary after `go generate ./frontend`.
- `cd frontend && npm run lint`: run ESLint on all `ts` and `tsx` files.
- `go test ./cmd/... ./internal/...`: run backend tests.

## Coding Style & Naming Conventions
Frontend code uses TypeScript, JSX, and the flat ESLint config in `frontend/eslint.config.js`. Follow the existing style: 2-space indentation, no semicolons, PascalCase for React components (`SiteHeader.tsx`), and camelCase for helpers. Keep feature code near its UI entrypoint and prefer `@/` imports inside the frontend.

Go code should stay `gofmt`-formatted, use standard mixedCaps names, and keep handlers small and explicit.

## Maintainability Rules
- Prefer cohesive files over large files. Use size limits as refactoring triggers, not absolute laws.
- Soft file size targets:
  - React component files (`*.tsx`): aim for under 250 lines.
  - TypeScript logic/helper files (`*.ts`): aim for under 300 lines.
  - Go files: aim for under 300 lines; review anything over 400 lines for splitting.
- If a file exceeds the target, split by responsibility, not arbitrarily. Do not create generic dump files like `utils.ts`, `helpers.ts`, `misc.ts`, or `misc.go`.

### TypeScript / React Practices
- Keep rendering, data fetching, and heavy data shaping separate. If a component does all three, extract a hook or a feature-local helper.
- Prefer feature-local code in `frontend/src/app/<feature>`; only move code into shared folders after a second real reuse.
- Keep non-UI helpers outside React components.
- Do not add `useMemo` or `useCallback` unless there is a clear performance or referential-stability reason.
- Prefer explicit state shapes and discriminated unions over many loosely-related booleans or optional fields.
- Break up a component when it has multiple async effects, several unrelated UI states, or large inline render branches.
- Prefer small presentational subcomponents over deeply nested JSX.

### Go Practices
- Keep HTTP handlers thin: parse input, validate, call a service, map errors, write the response.
- Split Go code by responsibility: entrypoint, HTTP routing, git command execution, and diff/file reading should stay in separate packages or files.
- Pass `context.Context` first for request-scoped work.
- Prefer concrete types; introduce interfaces only at real boundaries or when multiple implementations are needed.
- Wrap errors with context and translate them to HTTP responses only at the handler boundary.
- Avoid package-wide grab bags like `util.go`.

### Testing Expectations
- Add regression tests for bug fixes when feasible.
- Use table-driven tests for Go parsing, mapping, and status logic.
- Add frontend tests for non-trivial pure logic and custom hooks.
- `cd frontend && npm run lint`, `go generate ./frontend`, and `go test ./cmd/... ./internal/...` are the minimum verification steps for relevant changes.

## Commit & Pull Request Guidelines
History currently uses short, imperative subjects (`first commit`). Keep commits focused and use concise messages such as `embed frontend assets` or `simplify diff server`.

PRs should include:

- a brief summary of what changed
- linked issue or task reference when available
- screenshots or short recordings for UI changes
- verification notes listing commands you ran

## Configuration Notes
In source-checkout dev mode, the Go server proxies frontend traffic to Vite and still serves `/api` itself on port `8080`. Keep local config changes out of commits unless they are required for all contributors.
