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
  workspaceName: string
  scopePath: string
  files: ChangedFileItem[]
  initialDiff?: FileDiffResult
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
