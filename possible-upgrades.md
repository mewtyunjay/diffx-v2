# Possible Upgrades

Branch compared against `origin/main`: `codex/hunk-actions-partial-stage`.

This branch contains two semantic upgrade groups:
- `8bd6f74` `Optimize diff loading and file tree rendering`
- `3d0dc85` `add hunk-level partial staging`

## Decisions

1. Keep the existing diff transport, optimize around it

   The branch keeps the current `before`/`after` diff payload model instead of moving to patch-only transport. The first visible diff now reuses `/api/files.initialDiff` instead of immediately issuing a duplicate `/api/file-diff` request.

2. Parallelize independent reads

   Repo refresh can fetch changed files and branch state together, and backend file diff loading can read before/after versions concurrently. This is a latency improvement without changing user-facing behavior.

3. Make file-tree rendering cheaper

   Sidebar tree flattening now uses accumulator traversal and memoized rows, avoiding repeated recursive array spreads during stable sidebar renders.

4. Treat hunk actions as real Git index operations

   Pierre supplies hunk metadata, but Git owns the mutation. `Accept` stages the selected hunk into the Git index. `Reject` reverses the selected hunk out of the worktree, and also out of the index if it was already staged.

5. Add explicit hunk API endpoints

   The frontend now calls `/api/git/hunk/accept` and `/api/git/hunk/reject` with the file identity, status, hunk index, and hunk patch.

6. Keep path authority on the backend

   The UI sends the hunk body, but the backend wraps it with scoped file headers, validates the path and file status, rejects conflicted-file hunk actions, and applies the patch with Git. This avoids writing a second hunk parser in Go while still making the server authoritative.

7. Make staged index content visible to the frontend

   `FileDiffResult` now includes optional `stagedAfter` content. That lets the frontend compare base to index separately from base to worktree.

8. Include index state in file content keys

   Accepting a hunk can change only the index while leaving worktree bytes unchanged. Including an index hash in `contentKey` forces selected diffs to refresh after hunk staging.

9. Hide actions for hunks already accepted

   The frontend parses `stagedAfter` into a second Pierre diff and suppresses hunk action overlays for patches already present in the index.

10. Render hunk controls as right-side overlays

    Accept/reject controls are mounted as overlays inside Pierre's shadow DOM instead of being placed in the gutter or separator rows. This keeps controls visually attached to hunks without pushing code columns horizontally.

11. Add a partial staged UI state

    The selected-file Stage button can now show `Partially staged`, and the sidebar uses a stacked plus-over-minus icon when a file has both staged and unstaged changes.

12. Keep annotation controls separate from hunk controls

    The gutter annotation affordance remains a plus glyph. It tracks the last hovered line so clicking the slotted plus opens the annotation draft reliably.

13. Cover backend edge cases

    Tests cover staging only one hunk, rejecting unstaged and staged hunks, partially staging added files, removing empty added files after rejection, exposing staged index content, and opening untracked new files without `git show :path` failures.

## PR Scope Note

This branch was created on top of `codex/optimize-diffx-performance`, so a PR to `main` includes both the performance optimization commit and the hunk-level partial staging commit.

If the PR should contain only hunk staging, rebase or cherry-pick `3d0dc85` onto `main`.
