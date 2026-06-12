import type {
  BranchesResult,
  ChangedFileItem,
  ChangedFilesResult,
  ApprovePullRequestInput,
  CommitDetailResult,
  CommitsResult,
  CommitResult,
  ConflictFileResult,
  ConflictResolveResult,
  FileDiffResult,
  HunkActionInput,
  MergePullRequestInput,
  PullRequestDetailResult,
  PullRequestsResult,
  PushResult,
  ReviewStateResult,
  RepoChangedEvent,
  SubmitReviewFeedbackInput,
} from "@/git/types"

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

function toStageFileRequest(file: Pick<ChangedFileItem, "path" | "previousPath">) {
  return file.previousPath
    ? { path: file.path, previousPath: file.previousPath }
    : { path: file.path }
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

export async function fetchCommits(limit = 100, offset = 0, signal?: AbortSignal) {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) })
  const response = await fetch(`/api/commits?${params.toString()}`, { signal })
  if (!response.ok) {
    throw new Error(await readError(response))
  }

  return (await response.json()) as CommitsResult
}

export async function fetchCommitDetail(hash: string, signal?: AbortSignal) {
  const params = new URLSearchParams({ hash })
  const response = await fetch(`/api/commit?${params.toString()}`, { signal })
  if (!response.ok) {
    throw new Error(await readError(response))
  }

  return (await response.json()) as CommitDetailResult
}

export async function fetchPullRequests(signal?: AbortSignal) {
  const response = await fetch("/api/pull-requests", { signal })
  if (!response.ok) {
    throw new Error(await readError(response))
  }

  return (await response.json()) as PullRequestsResult
}

export async function fetchPullRequestDetail(number: number, signal?: AbortSignal) {
  const params = new URLSearchParams({ number: String(number) })
  const response = await fetch(`/api/pull-request?${params.toString()}`, { signal })
  if (!response.ok) {
    throw new Error(await readError(response))
  }

  return (await response.json()) as PullRequestDetailResult
}

export type DiffSource =
  | { kind: "working-tree"; baseRef?: string }
  | { kind: "commit"; hash: string }
  | { kind: "pull-request"; number: number }

const DIFF_SOURCE_ENDPOINTS = {
  "working-tree": "/api/file-diff",
  commit: "/api/commit-file-diff",
  "pull-request": "/api/pull-request-file-diff",
} as const

function diffSourceParams(source: DiffSource) {
  const params = new URLSearchParams()
  switch (source.kind) {
    case "working-tree":
      if (source.baseRef) {
        params.set("baseRef", source.baseRef)
      }
      break
    case "commit":
      params.set("hash", source.hash)
      break
    case "pull-request":
      params.set("number", String(source.number))
      break
  }

  return params
}

export async function fetchDiffForSource(
  source: DiffSource,
  file: Pick<ChangedFileItem, "path" | "previousPath" | "status">,
  signal?: AbortSignal
) {
  const params = diffSourceParams(source)
  params.set("path", file.path)
  params.set("status", file.status)
  if (file.previousPath) {
    params.set("previousPath", file.previousPath)
  }

  const response = await fetch(
    `${DIFF_SOURCE_ENDPOINTS[source.kind]}?${params.toString()}`,
    { signal }
  )
  if (!response.ok) {
    throw new Error(await readError(response))
  }

  return (await response.json()) as FileDiffResult
}

export async function stageFile(
  file: Pick<ChangedFileItem, "path" | "previousPath">,
  signal?: AbortSignal
) {
  return postJSON<void>("/api/git/stage", toStageFileRequest(file), signal)
}

export async function stageAll(signal?: AbortSignal) {
  return postJSON<void>("/api/git/stage-all", undefined, signal)
}

export async function unstageFile(
  file: Pick<ChangedFileItem, "path" | "previousPath">,
  signal?: AbortSignal
) {
  return postJSON<void>("/api/git/unstage", toStageFileRequest(file), signal)
}

export async function unstageAll(signal?: AbortSignal) {
  return postJSON<void>("/api/git/unstage-all", undefined, signal)
}

export async function discardFile(
  file: Pick<ChangedFileItem, "path" | "previousPath">,
  signal?: AbortSignal
) {
  return postJSON<void>("/api/git/discard", toStageFileRequest(file), signal)
}

export async function acceptHunk(input: HunkActionInput, signal?: AbortSignal) {
  return postJSON<void>("/api/git/hunk/accept", input, signal)
}

export async function rejectHunk(input: HunkActionInput, signal?: AbortSignal) {
  return postJSON<void>("/api/git/hunk/reject", input, signal)
}

export async function commitStaged(message: string, signal?: AbortSignal) {
  return postJSON<CommitResult>("/api/git/commit", { message }, signal)
}

export async function pushCurrentBranch(signal?: AbortSignal) {
  return postJSON<PushResult>("/api/git/push", undefined, signal)
}

export async function fetchRemote(signal?: AbortSignal) {
  return postJSON<void>("/api/git/fetch", undefined, signal)
}

export async function pullCurrentBranch(signal?: AbortSignal) {
  return postJSON<void>("/api/git/pull", undefined, signal)
}

export async function checkoutBranch(branch: string, signal?: AbortSignal) {
  return postJSON<void>("/api/git/checkout", { branch }, signal)
}

export async function approvePullRequest(input: ApprovePullRequestInput, signal?: AbortSignal) {
  return postJSON<void>("/api/pull-request/approve", input, signal)
}

export async function mergePullRequest(input: MergePullRequestInput, signal?: AbortSignal) {
  return postJSON<void>("/api/pull-request/merge", input, signal)
}

export async function fetchConflictFile(path: string, signal?: AbortSignal) {
  const params = new URLSearchParams({ path })
  const response = await fetch(`/api/git/conflict-file?${params.toString()}`, {
    signal,
  })
  if (!response.ok) {
    throw new Error(await readError(response))
  }

  return (await response.json()) as ConflictFileResult
}

export async function resolveConflictFile(path: string, contents: string, signal?: AbortSignal) {
  return postJSON<ConflictResolveResult>(
    "/api/git/conflict/resolve",
    { path, contents },
    signal
  )
}

export async function submitReviewFeedback(
  input: SubmitReviewFeedbackInput,
  signal?: AbortSignal
) {
  return postJSON<{ ok: boolean }>("/api/feedback", input, signal)
}

export async function fetchReviewState(signal?: AbortSignal) {
  const response = await fetch("/api/review/state", { signal })
  if (!response.ok) {
    throw new Error(await readError(response))
  }

  return (await response.json()) as ReviewStateResult
}

export function subscribeRepoEvents(
  onChange: (event: RepoChangedEvent) => void,
  onError?: (event: Event) => void,
) {
  if (typeof EventSource === "undefined") {
    return () => {}
  }

  const source = new EventSource("/api/events")
  const handleChange = (event: Event) => {
    const message = event as MessageEvent<string>

    try {
      const payload = JSON.parse(message.data) as RepoChangedEvent
      if (payload.kind !== "git" && payload.kind !== "worktree") {
        return
      }

      onChange(payload)
    } catch {
      return
    }
  }

  source.addEventListener("repo-changed", handleChange)
  if (onError) {
    source.addEventListener("error", onError)
  }

  return () => {
    source.removeEventListener("repo-changed", handleChange)
    if (onError) {
      source.removeEventListener("error", onError)
    }
    source.close()
  }
}
