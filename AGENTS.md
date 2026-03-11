# Repository Guidelines

## Project Structure & Module Organization
This repository has two active areas:

- `frontend/`: Vite + React 19 + TypeScript UI. App entry is `frontend/src/main.tsx`, with page composition in `frontend/src/App.tsx`.
- `frontend/src/components/`: shared UI and layout components. Low-level primitives live in `frontend/src/components/ui/`.
- `frontend/src/app/`: app-specific data and feature folders, such as `frontend/src/app/dashboard/`.
- `frontend/src/hooks/` and `frontend/src/lib/`: reusable hooks and helpers.
- `internal/`: Go backend module. The HTTP server entrypoint is `internal/cmd/server/main.go`.

## Build, Test, and Development Commands
Run commands from the relevant package directory.

- `cd frontend && npm install`: install frontend dependencies.
- `cd frontend && npm run dev`: start the Vite dev server.
- `cd frontend && npm run build`: run TypeScript build checks and produce a production bundle in `frontend/dist/`.
- `cd frontend && npm run lint`: run ESLint on all `ts` and `tsx` files.
- `cd frontend && npm run preview`: serve the built frontend locally.
- `cd internal && go run ./cmd/server`: start the Go API on `:8080`.
- `cd internal && go test ./...`: run backend tests when test files are added.

## Coding Style & Naming Conventions
Frontend code uses TypeScript, JSX, and the flat ESLint config in `frontend/eslint.config.js`. Follow the existing style: 2-space indentation, no semicolons, PascalCase for React components (`SiteHeader.tsx`), and camelCase for hooks and helpers (`use-mobile.ts`, `utils.ts`). Keep feature code near its UI entrypoint and prefer `@/` imports inside the frontend.

Go code should stay `gofmt`-formatted, use standard mixedCaps names, and keep handlers small and explicit.

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
