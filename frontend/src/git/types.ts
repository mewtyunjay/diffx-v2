export type ChangedFileStatus = "added" | "modified" | "deleted" | "renamed" | "conflicted"
export type ComparisonMode = "head" | "branch"
export type BranchKind = "local" | "remote"

export type BranchOption = {
  name: string
  kind: BranchKind
  commit: string
  isCurrent?: boolean
}

export type BranchesResult = {
  currentRef: string
  branches: BranchOption[]
}

export type ChangedFileItem = {
  id: string
  path: string
  displayPath: string
  previousPath?: string
  status: ChangedFileStatus
  isTracked: boolean
  hasStagedChanges: boolean
  hasUnstagedChanges: boolean
  conflictBlocksRemaining?: number
  contentKey: string
  language?: string
}

export type ChangedFilesResult = {
  mode: ComparisonMode
  baseRef: string
  baseCommit: string
  currentRef: string
  currentCommit: string
  upstreamRef?: string
  branchSync: BranchSyncState
  mergeState: MergeState
  repoName: string
  workspaceName: string
  scopePath: string
  hiddenStagedFileCount: number
  files: ChangedFileItem[]
  diffs?: FileDiffResult[]
  initialDiff?: FileDiffResult
}

export type MergeState = {
  inProgress: boolean
  unresolvedCount: number
}

export type BranchSyncState = {
  hasUpstream: boolean
  upstreamRef?: string
  aheadCount: number
  behindCount: number
}

export type CommitResult = {
  commit: string
}

export type PushResult = {
  remoteRef: string
  createdUpstream: boolean
}

export type CommitItem = {
  hash: string
  shortHash: string
  subject: string
  authorName: string
  authorDate: string
}

export type CommitsResult = {
  currentRef: string
  commits: CommitItem[]
  offset: number
  nextOffset: number
  hasMore: boolean
}

export type CommitDetailResult = {
  kind: "commit"
  commit: CommitItem
  parentHash: string
  currentRef: string
  files: ChangedFileItem[]
}

export type GitHubIntegrationStatus =
  | "ok"
  | "gh_missing"
  | "gh_unauthenticated"
  | "repo_unresolved"
  | "listing_failed"
  | "permission_denied"
  | "merge_blocked"
  | "not_found"
  | "unknown"

export type GitHubIntegrationState = {
  status: GitHubIntegrationStatus
  message: string
  action?: string
}

export type GitHubRepositoryMergeCapabilities = {
  mergeCommitAllowed: boolean
  squashMergeAllowed: boolean
  rebaseMergeAllowed: boolean
  viewerDefaultMergeMethod?: MergeMethod
}

export type GitHubRepository = {
  owner: string
  name: string
  url: string
  mergeCapabilities: GitHubRepositoryMergeCapabilities
}

export type PullRequestListItem = {
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

export type PullRequestsResult = {
  repo: GitHubRepository
  prs: PullRequestListItem[]
  state: GitHubIntegrationState
}

export type PullRequestRef = {
  refName: string
  sha: string
  repositoryOwner?: string
  repositoryName?: string
}

export type PullRequestDetail = {
  number: number
  title: string
  url: string
  author: string
  body?: string
  state: string
  isDraft: boolean
  createdAt: string
  updatedAt: string
  labels: string[]
  commentsCount?: number
  commitsCount?: number
  changedFilesCount?: number
}

export type MergeMethod = "merge" | "squash" | "rebase"

export type PullRequestMergeState = {
  mergeable?: string
  stateStatus?: string
  canMerge: boolean
  blockedReason?: string
  allowedMethods: MergeMethod[]
  defaultMethod?: MergeMethod
}

export type PullRequestChecksSummary = {
  conclusion: "success" | "failure" | "pending" | "neutral" | "skipped" | "unknown"
  totalCount: number
  successCount: number
  failureCount: number
  pendingCount: number
  skippedCount: number
}

export type PullRequestReview = {
  author: string
  state: string
  submittedAt?: string
  body?: string
}

export type PullRequestReviewsSummary = {
  decision?: "APPROVED" | "CHANGES_REQUESTED" | "REVIEW_REQUIRED" | ""
  requiredReviewers: string[]
  latestReviews: PullRequestReview[]
}

export type PullRequestLocalDiffState = {
  status: "local_diff_failed"
  message: string
}

export type PullRequestDetailResult = {
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
  localDiff?: PullRequestLocalDiffState
  outsideScopeCount?: number
  scopePath: string
}

export type ApprovePullRequestInput = {
  number: number
  body?: string
}

export type MergePullRequestInput = {
  number: number
  method?: MergeMethod
}

export type HunkActionInput = Pick<
  FileDiffResult,
  "path" | "previousPath" | "status"
> & {
  hunkIndex: number
  hunkPatch: string
}

export type SubmitReviewFeedbackInput = {
  approved: boolean
  feedback: string
  annotations: unknown[]
}

export type ReviewStateReason = "active" | "closed" | "disabled" | "inactive" | "submitted"

export type ReviewStateResult = {
  enabled: boolean
  acceptingFeedback: boolean
  submitted: boolean
  closed: boolean
  reason: ReviewStateReason
}

export type RepoChangedEvent = {
  kind: "worktree" | "git"
}

export type FileVersionResult = {
  name: string
  contents: string
  cacheKey: string
}

export type FileDiffResult = {
  mode: ComparisonMode
  baseRef: string
  baseCommit: string
  currentRef: string
  currentCommit: string
  path: string
  previousPath?: string
  status: ChangedFileStatus
  language?: string
  before: FileVersionResult
  after: FileVersionResult
  stagedAfter?: FileVersionResult
  binary?: boolean
  tooLarge?: boolean
}

export type ConflictFileResult = {
  path: string
  exists: boolean
  language?: string
  contents: string
  contentKey: string
  binary?: boolean
  tooLarge?: boolean
}

export type ConflictResolveResult = {
  path: string
  contentKey: string
}
