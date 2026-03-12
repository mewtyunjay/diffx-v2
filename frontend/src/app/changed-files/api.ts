export type ChangedFileStatus = "added" | "modified" | "deleted" | "renamed"

export type ChangedFileItem = {
  id: string
  path: string
  status: ChangedFileStatus
  isTracked: boolean
  hasStagedChanges: boolean
  hasUnstagedChanges: boolean
  contentKey: string
}

type ChangedFilesResponse = {
  files: ChangedFileItem[]
}

export type FileContentResult = {
  contentKey: string
  text: string
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

  const data = (await response.json()) as ChangedFilesResponse
  return data.files
}

export async function fetchFileContent(
  path: string,
  contentKey: string,
  signal?: AbortSignal
) {
  const params = new URLSearchParams({ path })
  if (contentKey) {
    params.set("contentKey", contentKey)
  }

  const response = await fetch(`/api/file-content?${params.toString()}`, {
    signal,
  })
  if (!response.ok) {
    throw new Error(await readError(response))
  }

  return {
    contentKey: response.headers.get("X-Content-Key") ?? contentKey,
    text: await response.text(),
  } satisfies FileContentResult
}
