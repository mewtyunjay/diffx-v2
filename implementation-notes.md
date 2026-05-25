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

---

# Hunk-Level Accept/Reject Notes

Date: 2026-05-22

Scope:
- Add hunk-level accept/reject for normal `HEAD` worktree review.
- Accept means "stage this hunk into the Git index." Commit still uses the existing staged-only commit flow, so a commit after accepting one hunk commits only that accepted hunk.
- Reject means "reverse this hunk out of the working tree"; if the same hunk is already staged, reject also reverses it out of the index.

Decisions and tradeoffs:
- Pierre remains the rendering and hunk-location layer. The actual mutation is not Pierre's `diffAcceptRejectHunk`; backend Git owns it via `git apply` so the index/worktree are the source of truth.
- The frontend sends the hunk patch rendered from Pierre's parsed hunk metadata. The backend wraps that hunk with a scoped file header and validates the path before applying it. This avoids inventing a second hunk parser in Go while keeping path authority on the server.
- The hover utility is annotation-only again. Accept/reject controls now render as right-side overlays at each hunk instead of inside the gutter or separator row, so they stay attached to the hunk without pushing code columns horizontally.
- Pierre's separator rows participate in the diff grid layout, so placing actions there can shift the rendered diff. I kept Pierre's normal `line-info` separators and added a post-render overlay layer inside the diff shadow DOM.
- The hunk overlay DOM plumbing lives in `frontend/src/components/diff/hunk-action-overlays.ts` so `DiffPaneRenderer.tsx` remains focused on React state, annotations, and Pierre option wiring.
- The overlay controls use inline styles because they are mounted inside Pierre's shadow root; normal app stylesheet rules do not reliably cross that boundary.
- The annotation affordance uses the Pierre plus glyph again, but still renders through the app's custom gutter utility button so the existing explicit annotation click handler is preserved.
- The custom gutter utility keeps the last hovered diff line from Pierre's line-enter callback. This covers the slotted-button click path where moving from a line into the utility can clear Pierre's current hovered-line lookup before React handles the click.
- The selected-file Stage control now has a visible partial state. Files with both index and worktree changes render as `Partially staged`, and sidebar row actions use a combined plus/minus glyph for the same state.
- `FileDiffResult` now includes an optional staged index version for `HEAD` diffs. The frontend parses that as a second Pierre diff and suppresses hunk action overlays whose patch is already present in the index, so accepted hunks stop showing accept/reject controls.
- Staged-hunk matching normalizes the generated hunk header's `+` side coordinates before comparison. Accepted hunks can shift on the new-file side when earlier unstaged additions remain, while the base-side location and patch body still identify the accepted hunk.
- File `contentKey` now includes the Git index entry hash when available. This forces selected diffs to refetch after hunk staging, even when the worktree file bytes did not change.
- The partial-stage glyph is composed from Lucide `Plus` above `Minus`, not diagonally overlapped icons, so it reads as one stacked plus/minus state marker in both the toolbar and sidebar.
- Untracked added files have no Git index entry, so staged-version lookup now returns "not staged" before calling `git show :path`. Without that guard, opening a new untracked file failed with Git exit status 128.
- Hunk actions are enabled only in `HEAD` comparison mode and not during merge-conflict mode. Branch comparison diffs and conflict resolution remain read-only for this flow.
- Accepting every hunk converges to the same index state as staging the file. Rejecting every hunk converges to a clean working tree for tracked files; for added files, an empty untracked file left after rejection is removed.
- Rename metadata is still file-level. Hunk actions can operate on textual content hunks for a renamed file, but staging the rename itself remains the existing whole-file stage action.

Verification completed:
- `go test ./internal/gitstatus`
- `cd frontend && npm run lint`
- `cd frontend && npm run build`
- `go test ./cmd/... ./internal/...`
- `go generate ./frontend`
- `git diff --check`
- Browser smoke check at `http://127.0.0.1:18080`: the diff pane rendered an overlay layer inside the diff shadow DOM, showed one right-side `Reject (revert)`/`Accept` overlay for the visible hunk, no old separator action buttons, and the annotation button still appeared on changed-line hover.
- In-app browser check at `http://127.0.0.1:18080`: hovering an added line rendered the custom gutter utility with the plus glyph, no `MessageSquarePlus` icon remained, and clicking the plus opened the annotation draft textarea.

Known follow-up:
- `go generate ./frontend` ran `npm install` and still reported 5 npm audit findings (2 moderate, 3 high). I did not run `npm audit fix` because dependency upgrades are outside this hunk-action slice.
