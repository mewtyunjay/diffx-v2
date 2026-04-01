# Repository Guidelines

## Project Structure & Module Organization
This repository has two active areas:

- `frontend/`: Vite + React 19 + TypeScript UI. App entry is `frontend/src/main.tsx`, with page composition in `frontend/src/App.tsx`.
- `frontend/src/components/`: shared UI and layout components. Low-level primitives live in `frontend/src/components/ui/`.
- `frontend/src/app/`: app-specific data and feature folders, such as `frontend/src/app/dashboard/`.
- `frontend/src/hooks/` and `frontend/src/lib/`: reusable hooks and helpers.
- `cmd/`: Go entrypoints. The HTTP server entrypoint is `cmd/server/main.go`.
- `internal/`: Go backend packages and services.

## Build, Test, and Development Commands
Run commands from the relevant package directory.

- `go build -o cli ./cmd/cli`: build the developer CLI binary at the repo root.
- `./cli install`: install backend and frontend dependencies from the repo root.
- `./cli dev`: start the Vite frontend and hot-reloading Go backend together from the repo root.
- `./cli build`: build the frontend bundle and backend binary from the repo root.
- `cd frontend && npm install`: install frontend dependencies.
- `cd frontend && npm run dev`: start the Vite dev server.
- `cd frontend && npm run build`: run TypeScript build checks and produce a production bundle in `frontend/dist/`.
- `cd frontend && npm run lint`: run ESLint on all `ts` and `tsx` files.
- `cd frontend && npm run preview`: serve the built frontend locally.
- `go run ./cmd/server`: start the Go API on `:8080`.
- `go test ./cmd/... ./internal/...`: run backend tests when test files are added.

## Coding Style & Naming Conventions
Frontend code uses TypeScript, JSX, and the flat ESLint config in `frontend/eslint.config.js`. Follow the existing style: 2-space indentation, no semicolons, PascalCase for React components (`SiteHeader.tsx`), and camelCase for hooks and helpers (`use-mobile.ts`, `utils.ts`). Keep feature code near its UI entrypoint and prefer `@/` imports inside the frontend.

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
- Split Go code by responsibility, not by “component”: handlers, parsing, git command execution, caching, and diff/file reading should be separable when they grow.
- Prefer small functions with one main job. If a function mixes validation, I/O, parsing, and formatting, extract helpers.
- Pass `context.Context` first for request-scoped work.
- Prefer concrete types; introduce interfaces only at real boundaries or when multiple implementations are needed.
- Wrap errors with context and translate them to HTTP responses only at the handler boundary.
- Avoid package-wide grab bags like `util.go`.

### Testing Expectations
- Add regression tests for bug fixes when feasible.
- Use table-driven tests for Go parsing, mapping, and status logic.
- Add frontend tests for non-trivial pure logic and custom hooks.
- `cd frontend && npm run lint`, `cd frontend && npm run build`, and `go test ./cmd/... ./internal/...` are the minimum verification steps for relevant changes.

## Testing Guidelines
There is no committed test suite yet. For frontend changes, treat `npm run lint` and `npm run build` as the minimum verification gate. Add tests alongside new behavior when introducing non-trivial logic. Use `*.test.ts` or `*.test.tsx` naming in the frontend, and Go `_test.go` files in the same package as the code under test.

## Commit & Pull Request Guidelines
History currently uses short, imperative subjects (`first commit`). Keep commits focused and use concise messages such as `add dashboard table sorting` or `wire hello endpoint`. PRs should include:

- a brief summary of what changed
- linked issue or task reference when available
- screenshots or short recordings for UI changes
- verification notes listing commands you ran

## Configuration Notes
The frontend expects the API server on port `8080` (`/api/hello` in the current backend). Keep local config changes out of commits unless they are required for all contributors.
