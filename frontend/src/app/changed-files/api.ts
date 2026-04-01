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

async function readError(response: Response) {
  const text = await response.text()
  return text || `Request failed with status ${response.status}`
}

async function postJSON<TResponse>(url: string, body?: unknown, signal?: AbortSignal) {
  const response = await fetch(url, {
    method: "POST",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  })

  if (!response.ok) {
    throw new Error(await readError(response))
  }

  if (response.status === 204) {
    return undefined as TResponse
  }

  return (await response.json()) as TResponse
}

export async function fetchChangedFiles(baseRef?: string, signal?: AbortSignal) {
  const params = new URLSearchParams()
  if (baseRef && baseRef !== "HEAD") {
    params.set("baseRef", baseRef)
  }

  const response = await fetch(
    params.size > 0 ? `/api/files?${params.toString()}` : "/api/files",
    { signal }
  )
  if (!response.ok) {
    throw new Error(await readError(response))
  }

  return (await response.json()) as ChangedFilesResult
}

export async function fetchBranches(signal?: AbortSignal) {
  const response = await fetch("/api/branches", { signal })
  if (!response.ok) {
    throw new Error(await readError(response))
  }

  return (await response.json()) as BranchesResult
}

export async function fetchFileDiff(
  file: Pick<ChangedFileItem, "path" | "previousPath" | "status">,
  baseRef?: string,
  signal?: AbortSignal
) {
  const params = new URLSearchParams({
    path: file.path,
    status: file.status,
  })

  if (file.previousPath) {
    params.set("previousPath", file.previousPath)
  }

  if (baseRef) {
    params.set("baseRef", baseRef)
  }

  const response = await fetch(`/api/file-diff?${params.toString()}`, {
    signal,
  })
  if (!response.ok) {
    throw new Error(await readError(response))
  }

  return (await response.json()) as FileDiffResult
}

export async function stageFile(
  file: Pick<ChangedFileItem, "path" | "previousPath">,
  signal?: AbortSignal
) {
  return postJSON<void>("/api/git/stage", file, signal)
}

export async function unstageFile(
  file: Pick<ChangedFileItem, "path" | "previousPath">,
  signal?: AbortSignal
) {
  return postJSON<void>("/api/git/unstage", file, signal)
}

export async function commitStaged(message: string, signal?: AbortSignal) {
  return postJSON<CommitResult>("/api/git/commit", { message }, signal)
}

export async function pushCurrentBranch(signal?: AbortSignal) {
  return postJSON<PushResult>("/api/git/push", undefined, signal)
}
