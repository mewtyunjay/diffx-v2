export type ChangedFileStatus = "added" | "modified" | "deleted" | "renamed"

export type ChangedFileItem = {
  id: string
  path: string
  previousPath?: string
  status: ChangedFileStatus
  isTracked: boolean
  hasStagedChanges: boolean
  hasUnstagedChanges: boolean
  contentKey: string
  language?: string
}

export type ChangedFilesResult = {
  headCommit: string
  files: ChangedFileItem[]
  initialDiff?: FileDiffResult
}

export type FileVersionResult = {
  name: string
  contents: string
  cacheKey: string
}

export type FileDiffResult = {
  headCommit: string
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

export async function fetchChangedFiles(signal?: AbortSignal) {
  const response = await fetch("/api/files", { signal })
  if (!response.ok) {
    throw new Error(await readError(response))
  }

  return (await response.json()) as ChangedFilesResult
}

export async function fetchFileDiff(
  file: Pick<ChangedFileItem, "path" | "previousPath" | "status">,
  headCommit?: string,
  signal?: AbortSignal
) {
  const params = new URLSearchParams({
    path: file.path,
    status: file.status,
  })

  if (file.previousPath) {
    params.set("previousPath", file.previousPath)
  }

  if (headCommit) {
    params.set("headCommit", headCommit)
  }

  const response = await fetch(`/api/file-diff?${params.toString()}`, {
    signal,
  })
  if (!response.ok) {
    throw new Error(await readError(response))
  }

  return (await response.json()) as FileDiffResult
}
