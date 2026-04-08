export type ChangedFileStatus = "added" | "modified" | "deleted" | "renamed"
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
  repoName: string
  workspaceName: string
  scopePath: string
  hiddenStagedFileCount: number
  files: ChangedFileItem[]
  initialDiff?: FileDiffResult
}

export type CommitResult = {
  commit: string
}

export type PushResult = {
  remoteRef: string
}

export type SubmitReviewFeedbackInput = {
  approved: boolean
  feedback: string
  annotations: unknown[]
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
  binary?: boolean
  tooLarge?: boolean
}
