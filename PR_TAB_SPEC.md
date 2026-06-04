# DiffX PR Tab Spec

## Goal
Build a production-grade PR tab that brings the core GitHub pull request workflow into DiffX without losing DiffX's local, high-performance diff review experience.

The PR tab should start as a GitHub-backed view of all open PRs in the current repository. Selecting a PR should open an in-app detail surface with metadata, readiness state, commits, changed files, and local Git-powered diffs. The first shippable phase should support viewing, approving, and merging PRs into the PR's GitHub base branch.

This spec is intended for a long-running `/goal`. Do not treat it as an exec plan; use it as the product and engineering contract for the implementation.

## Decisions
- GitHub integration is required.
- Use the `gh` CLI for v1 GitHub operations.
- Show all open PRs in the repository.
- Include both a PR list and a selected PR detail/review surface.
- Start with open PRs only; keep types extensible for closed and merged PRs later.
- Use GitHub metadata as the control plane and local Git object diffs as the diff plane.
- Do not checkout PR branches to compute diffs.
- Build PR-specific UI components and state hooks; do not route PR detail through generic change-set presentation.
- Approve and merge actions both require explicit confirmation.
- Merge targets the PR's base branch on GitHub, not the user's current local branch.
- Merge method is auto-defaulted from GitHub/repo capabilities where possible.

## Non-Goals For V1
- Repo-wide closed/merged PR browsing.
- Editing PR title/body.
- Creating PRs.
- Creating line comments.
- Resolving review threads.
- Submitting change-request reviews.
- Full GitHub notification inbox behavior.
- Checking out PR branches automatically.

## Backend Architecture

### Package Boundaries
Add a narrow GitHub-facing service boundary rather than placing `gh` calls in HTTP handlers.

Recommended structure:
- `internal/github/`: GitHub PR service backed by `gh`.
- `internal/gitstatus/`: local Git diff, ref fetch, object reads, and existing change-set primitives.
- `internal/server/`: thin HTTP handlers that validate input, call services, map errors, and write JSON.

The `internal/github` package should own:
- `gh` availability checks.
- Auth status checks.
- Current repository resolution from Git remote metadata.
- Open PR listing.
- PR detail metadata.
- PR review/approve.
- PR merge.
- Normalizing `gh` JSON into stable DiffX API types.

The `internal/gitstatus` package should own:
- Fetching PR refs into namespaced local refs.
- Computing PR file lists.
- Reading PR file versions.
- Producing `FileDiffResult` compatible payloads.

### GitHub CLI Requirements
The backend should detect and report these states distinctly:
- `gh` is not installed.
- `gh` is installed but unauthenticated.
- Current Git repo cannot be mapped to a GitHub repository.
- GitHub repository exists but PR listing fails.
- Selected PR metadata loads but local PR diff fetch fails.
- User lacks permission to approve or merge.

All `gh` execution must be:
- Server-side only.
- `context.Context` cancelable.
- Time-bounded.
- Parsed from JSON output where `gh` supports it.
- Wrapped with useful errors that avoid dumping noisy CLI text directly into the UI.

### PR Listing Endpoint
Add:

```text
GET /api/pull-requests
```

V1 behavior:
- Returns all open PRs for the current GitHub repository.
- Includes enough metadata for a GitHub-like sidebar list.
- Does not require a local branch for each PR.
- Does not mutate the working tree.

Recommended response shape:

```ts
type PullRequestsResult = {
  repo: GitHubRepository
  prs: PullRequestListItem[]
  state: GitHubIntegrationState
}

type PullRequestListItem = {
  number: number
  title: string
  url: string
  author: string
  isDraft: boolean
  baseRefName: string
  headRefName: string
  headRepositoryOwner?: string
  headRepositoryName?: string
  updatedAt: string
  createdAt: string
  labels: string[]
  reviewDecision?: "APPROVED" | "CHANGES_REQUESTED" | "REVIEW_REQUIRED" | ""
  checkConclusion?: "success" | "failure" | "pending" | "neutral" | "skipped" | "unknown"
  commentsCount?: number
  commitsCount?: number
  changedFilesCount?: number
}
```

### PR Detail Endpoint
Add:

```text
GET /api/pull-request?number=123
```

V1 behavior:
- Returns PR metadata, readiness state, checks summary, reviewers, commits, and changed file list.
- Ensures local refs needed for diff review are available.
- Computes changed files locally with Git after fetching the relevant PR refs.
- Uses GitHub's PR base/head semantics. The backend must compute the merge-base for `base...head` and use that merge-base as the before side for file lists and file contents so DiffX matches GitHub's Files changed view.

Recommended response shape:

```ts
type PullRequestDetailResult = {
  kind: "pull-request"
  pr: PullRequestDetail
  repo: GitHubRepository
  base: PullRequestRef
  head: PullRequestRef
  merge: PullRequestMergeState
  checks: PullRequestChecksSummary
  reviews: PullRequestReviewsSummary
  commits: CommitItem[]
  files: ChangedFileItem[]
}
```

### PR File Diff Endpoint
Add:

```text
GET /api/pull-request-file-diff?number=123&path=...&status=...&previousPath=...
```

V1 behavior:
- Reuses the existing `FileDiffResult` frontend contract.
- Reads before/after content from Git objects, not the working tree.
- Does not checkout, stash, reset, or modify user files.
- Uses existing scope filtering through `AllowsDiff(path, previousPath)`.
- Handles renamed, deleted, added, binary, and too-large files consistently with current diff endpoints.

### Local Ref Strategy
Fetching PR diffs locally must avoid touching the working tree.

Recommended ref namespace:

```text
refs/diffx/pr/<number>/head
refs/diffx/pr/<number>/base
```

Recommended flow:
- Resolve PR metadata through `gh`.
- Fetch the PR head ref into `refs/diffx/pr/<number>/head`.
- Fetch or resolve the base SHA/ref into `refs/diffx/pr/<number>/base`.
- Compute the GitHub-style comparison base with `git merge-base refs/diffx/pr/<number>/base refs/diffx/pr/<number>/head`.
- Compute file list with `git diff --name-status -z -M <merge-base> refs/diffx/pr/<number>/head --`.
- Read before versions with `git show <merge-base>:<path>` and after versions with `git show refs/diffx/pr/<number>/head:<path>`.

Important invariant: unstaged and staged local changes must not affect selected PR detail or file diffs.

### Fork PRs
Fork PRs must be supported where GitHub and local Git allow it.

Backend should:
- Prefer GitHub-provided head/base SHAs when available.
- Fetch from an appropriate ref when origin exposes `pull/<number>/head`.
- Return a partial detail state if metadata loads but local diff fetch fails.
- Make the UI error specific: "PR metadata loaded, but DiffX could not fetch local Git objects for the diff."

### Approve Endpoint
Add:

```text
POST /api/pull-request/approve
```

Request:

```ts
type ApprovePullRequestRequest = {
  number: number
  body?: string
}
```

Behavior:
- Requires confirmation in the UI before calling.
- Runs `gh pr review <number> --approve`.
- Refreshes selected PR detail and list state after success.
- Handles already-approved, self-approval-blocked, permission-denied, and unauthenticated states cleanly.

### Merge Endpoint
Add:

```text
POST /api/pull-request/merge
```

Request:

```ts
type MergePullRequestRequest = {
  number: number
  method?: "merge" | "squash" | "rebase"
}
```

Behavior:
- Requires confirmation in the UI before calling.
- Merges into the PR's GitHub base branch.
- Does not merge into or checkout the local current branch.
- Uses GitHub/repo capabilities to determine allowed methods.
- Auto-selects a default method:
  - GitHub/repo default if discoverable.
  - Otherwise `merge` if allowed.
  - Otherwise `squash` if allowed.
  - Otherwise `rebase` if allowed.
- Surfaces blocked merge reasons: draft PR, failing required checks, missing required reviews, conflicts, permissions, branch protection, or unknown GitHub refusal.
- Refreshes the PR list after success; merged PRs disappear from the open-only v1 list.

## UI Architecture

### Sidebar PR Panel
Replace the current PR placeholder with a real open PR list.

The panel should include:
- Sticky header with repo PR count and refresh control.
- Loading skeleton.
- Empty state for no open PRs.
- GitHub integration error state with actionable copy.
- Scrollable open PR list.
- Selected state.
- Badges for draft, review decision, checks, labels, and current branch when applicable.

V1 should not include closed/merged filters. It can keep the component/API names broad enough to add them later.

### PR List Item
Each item should show:
- PR number.
- Title.
- Author.
- Base branch.
- Head branch.
- Updated time.
- Draft badge.
- Review/check status.
- Changed file count if available.

Rows must be dense, stable, and keyboard accessible. Long titles and branch names should truncate rather than resize the layout.

### Main PR Detail Surface
Selecting a PR should show a PR-specific DiffX detail page in the main pane. Do not use a generic `ChangeSetDetailPane` for this surface. Recent app direction favors explicit commit and PR components over shared catch-all presentation, and PR detail needs first-class affordances for checks, reviews, approval, and merge state.

Recommended component shape:
- `frontend/src/app/diff-viewer/pull-request/PullRequestDetailPane.tsx`
- `frontend/src/app/diff-viewer/pull-request/PullRequestListPanel.tsx`
- `frontend/src/app/diff-viewer/pull-request/PullRequestHeader.tsx`
- `frontend/src/app/diff-viewer/pull-request/PullRequestChecksSummary.tsx`
- `frontend/src/app/diff-viewer/pull-request/PullRequestReviewsSummary.tsx`
- `frontend/src/app/diff-viewer/pull-request/PullRequestActions.tsx`
- `frontend/src/app/diff-viewer/pull-request/usePullRequestsState.ts`
- `frontend/src/app/diff-viewer/pull-request/usePullRequestDetailState.ts`
- `frontend/src/app/diff-viewer/pull-request/usePullRequestActions.ts`

### PR Detail Header
In UI language, this is the PR detail header: an entity/detail header for the selected pull request. It should be functionally close to GitHub's pull request header while matching DiffX's visual system.

Use `PullRequestHeader.tsx` as the PR-specific component for this surface. Do not fold this into a generic change-set header.

The header should include:
- Title row with editable-looking but read-only PR title text, PR number, and open/draft/merged-state badge.
- Metadata sentence matching GitHub's information density: author, head branch, base branch, commit count, changed file count, and last updated/created time.
- Branch comparison affordance showing `head -> base`, with fork owner/repo when present.
- Review/check summary row with review decision, required reviewers, checks rollup, conflict/mergeability state, and blocked reason if any.
- Primary action cluster with Open in GitHub, Refresh, Approve, and Merge.
- Merge method disclosure when multiple methods are available.
- Disabled action explanations directly attached to buttons/tooltips, not hidden in a generic error banner.
- Optional section tabs or segmented navigation for Conversation, Commits, Checks, and Files when those sections are implemented.
- Compact responsive layout that keeps title, state, and primary actions visible before secondary metadata wraps.

Functional expectations:
- The header is the command center for PR review readiness.
- Approve and Merge launch confirmation dialogs from the header.
- Merge always labels the actual base branch target.
- If the PR is draft, blocked, failing required checks, missing reviews, or conflicted, the header must explain why merge is unavailable.
- Header data must update after approve, merge, refresh, or selected PR changes.

Body should include:
- Summary/description area.
- Checks summary.
- Reviewers/reviews summary.
- Commit list.
- Stacked changed-file diffs using existing low-level `StackedChangeSetDiffs`.

The first implementation can prioritize metadata header plus files/diffs, then add richer checks/reviews/commits panels within the same contract.

### Confirmation Dialogs
Approval confirmation must show:
- PR number and title.
- Author.
- Base branch.
- Current review/check state.
- Optional approval body if supported in the first pass.

Merge confirmation must show:
- PR number and title.
- Base branch target.
- Selected merge method.
- Checks/review status.
- Blocked warnings if GitHub reports any.

Approval and merge buttons must have clear pending, success, and failure states. Merge must be disabled when the backend reports that GitHub will not allow it.

## Integration With Existing DiffX

### Selection Model
Keep the existing app-level selection model, but make the PR branch explicit and numeric:

```ts
type ChangeSetSource =
  | { kind: "working-tree" }
  | { kind: "commit"; hash: string }
  | { kind: "pull-request"; number: number }
```

The selection model can stay generic because the page needs to switch between working tree, commit detail, and PR detail. The rendering should not be generic: commits should continue through the commit-specific pane, and PRs should use a PR-specific pane.

PR detail may reuse low-level infrastructure:
- `StackedChangeSetDiffs` for stacked file rendering.
- `ChangedFileItem` and `FileDiffResult` API contracts.
- Diff viewer preferences such as split/unified and stacked/full-file modes.

PR detail should not reuse generic metadata/header presentation when that hides PR-specific behavior.

### Data Hooks
Add PR feature-local hooks:
- `usePullRequestsState`
- `usePullRequestDetailState`
- `usePullRequestActions`

Keep data fetching and shaping out of large render components. Place PR-specific data shaping next to the PR feature instead of adding broad helpers to shared folders.

### Repo Events
Repo event refresh should eventually refresh PR diffs when local refs change, but v1 should not over-refresh GitHub data. Use explicit refresh plus selected-PR refresh after approve/merge.

### Scope Handling
When DiffX is opened against a nested scope, PR detail should:
- Show PR metadata for the whole repository.
- Show changed files only inside the current DiffX scope.
- Make it clear when the PR has changes outside the current scope, if the backend can count them cheaply.

## Performance Requirements
- PR list should feel instant after initial load; cache the latest open list in frontend state.
- Do not fetch every PR's file list for the sidebar if `gh` list metadata is enough.
- Fetch selected PR detail lazily.
- Fetch file contents lazily through `StackedChangeSetDiffs`.
- Share only the diff rendering and file-version contracts; avoid generic PR/commit wrapper components that make PR-specific states harder to optimize.
- Keep local Git file-version caching compatible with PR object reads.
- Avoid large GitHub payloads for diffs; use local Git object reads instead.
- Bound `gh` and `git fetch` calls with contexts/timeouts.
- Avoid blocking the whole UI when one selected PR's diff cannot load.

## Testing Requirements

Backend:
- Unit-test `gh` JSON parsing with realistic fixtures.
- Unit-test PR merge method defaulting.
- Unit-test error classification for missing `gh`, unauthenticated `gh`, permission failures, and blocked merges.
- Unit-test merge-base selection for PR file lists and file contents.
- Integration-test local PR ref diff computation in a temporary Git repo where feasible.
- Regression-test that PR diff reads do not include unstaged local changes.
- Test fork/ref-fetch failure produces a partial detail state instead of losing metadata.

Frontend:
- Test PR list empty/loading/error/loaded states.
- Test selecting a PR loads detail.
- Test PR detail renders through PR-specific components, not generic change-set presentation.
- Test approve confirmation before API call.
- Test merge confirmation before API call.
- Test blocked merge disables the action and shows the reason.
- Test long titles/branches do not break sidebar layout.

Verification commands for relevant changes:
- `go test ./cmd/... ./internal/...`
- `cd frontend && npm run lint`
- `go generate ./frontend`
- Browser verification of sidebar PR list, selected PR detail, approve confirmation, merge confirmation, and responsive behavior.

## Phasing

### Phase 1: Backend Foundation
- Add `internal/github` service around `gh`.
- Add GitHub integration state detection.
- Add open PR list endpoint.
- Add selected PR detail endpoint.
- Add PR local ref fetch and file list computation.
- Add PR file diff endpoint using local Git objects.
- Add backend tests for parsing, errors, and local diff invariants.

### Phase 2: PR List UI
- Replace PR placeholder with open PR list.
- Add loading, empty, error, and selected states.
- Wire selection into `selectedChangeSet`.
- Preserve current Diff and Commits tab behavior.

### Phase 3: PR Detail UI
- Add PR-specific detail pane and feature-local subcomponents.
- Reuse stacked diff rendering only for the file diff body.
- Add metadata header, status chips, checks/reviews summary, commits, and file diffs.
- Handle partial states when GitHub metadata loads but local diff fetch fails.

### Phase 4: Approve And Merge
- Add approve endpoint and confirmation dialog.
- Add merge endpoint, merge method defaulting, blocked reason mapping, and confirmation dialog.
- Refresh list/detail after actions.
- Verify the merge target is always the PR base branch.

### Phase 5: GitHub Parity Expansion
Later phases can add:
- Closed and merged PR filters.
- PR creation.
- PR title/body editing.
- Full review comments.
- Thread resolution.
- Request changes/comment review submission.
- Review-request management.
- Assignee/label/milestone editing.
- Auto-merge controls.

## Acceptance Criteria
- The PR tab lists all open PRs for the current GitHub repository.
- Selecting a PR opens an in-app PR-specific detail surface.
- Selected PR diffs are computed locally without checking out branches or touching user changes.
- Selected PR diffs use the merge-base before side so the file list and contents match GitHub's Files changed semantics.
- Unstaged local changes do not appear in selected PR diffs.
- Approval requires confirmation and uses GitHub.
- Merge requires confirmation and merges into the PR base branch.
- Errors from missing `gh`, auth, permissions, fetch failures, and blocked merges are specific and actionable.
- Existing Diff, Conflicts, Commits, stage, commit, push, fetch, pull, checkout, and commit detail flows keep working.
