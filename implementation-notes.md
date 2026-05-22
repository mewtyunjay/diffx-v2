# Performance Optimization Pass Notes

Date: 2026-05-22

Scope:
- Current checkout is detached at `HEAD` while this pass is running.
- Do not push code.
- Focus on API latency, first diff loading, diff preparation, file-tree rendering, and safe diff-rendering reuse.

Docs checked:
- React performance docs: use memoization only for expensive/stable work and verify that props stay stable.
- `@pierre/diffs` docs: cache keys and worker pools are the intended high-value path for repeated diff rendering; cache keys must change when content changes.
- Go `net/http` docs: `ServeContent` is still the right primitive for static assets because it preserves conditional/range behavior.

Implemented optimizations:
1. `useSelectedDiff` now consumes the `/api/files` `initialDiff` payload directly when it matches the selected file. This prevents the app from scheduling a duplicate `/api/file-diff` request for the first visible file.
2. Repo-event refresh now requests files and branches concurrently for git events. Worktree-only events still refresh only files.
3. `/api/files` now overlaps branch sync metadata with changed-file/status processing after the comparison ref has been resolved.
4. `/api/file-diff` now loads before/after versions concurrently for modified, renamed, and conflicted files.
5. File-tree row derivation now uses accumulator traversal and memoized sidebar rows, avoiding recursive array spreads and repeated row rebuilds on stable parent renders.

Decisions and tradeoffs:
- I am not moving the app to a patch-only diff transport in this pass. That could reduce payload size, but it changes the `FileDiffResult` contract and annotation/rendering assumptions; the safer path is to preserve the existing before/after contract and remove proven duplicate or repeated work.
- I am not adding gzip middleware in this pass. The app is primarily localhost-oriented, and compression can trade payload size for CPU. The more foolproof API wins here are to avoid duplicated calls and overlap independent git/file reads.
- `go generate ./frontend` still reports a large Vite main chunk. Code-splitting the `@pierre/diffs`/Shiki-heavy path is a good follow-up, but I did not include it in the five-change pass because preserving one long-lived worker pool across file switches is more important than a quick lazy import.
- `npm install` completed and reported 5 audit findings (2 moderate, 3 high). I did not run `npm audit fix` because that can change dependency versions outside the performance scope.

Verification:
- `cd frontend && npm run lint`
- `go generate ./frontend`
- `go test ./cmd/... ./internal/...`
- `go test -race ./internal/gitstatus`
