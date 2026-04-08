import {
  subscribeRepoEvents,
} from "@/git/api"
import type { RepoChangedEvent } from "@/git/types"
import { useEffect, useRef } from "react"

type RefreshFn = (signal?: AbortSignal) => Promise<unknown>
type RefreshPhase = "files" | "branches"

type UseRepoEventsRefreshOptions = {
  refreshChangedFiles: RefreshFn
  refreshBranches: RefreshFn
  onError?: (error: Error, phase: RefreshPhase, signal: AbortSignal) => void
}

export function useRepoEventsRefresh({
  refreshChangedFiles,
  refreshBranches,
  onError,
}: UseRepoEventsRefreshOptions) {
  const refreshChangedFilesRef = useRef(refreshChangedFiles)
  const refreshBranchesRef = useRef(refreshBranches)
  const onErrorRef = useRef(onError)
  const queuedKindRef = useRef<RepoChangedEvent["kind"] | null>(null)
  const isRefreshingRef = useRef(false)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    refreshChangedFilesRef.current = refreshChangedFiles
  }, [refreshChangedFiles])

  useEffect(() => {
    refreshBranchesRef.current = refreshBranches
  }, [refreshBranches])

  useEffect(() => {
    onErrorRef.current = onError
  }, [onError])

  useEffect(() => {
    let cancelled = false

    const flushRefreshQueue = async (initialKind: RepoChangedEvent["kind"]) => {
      if (cancelled) {
        return
      }

      if (isRefreshingRef.current) {
        queuedKindRef.current = mergeRepoChangeKind(queuedKindRef.current, initialKind)
        return
      }

      isRefreshingRef.current = true
      let nextKind: RepoChangedEvent["kind"] | null = initialKind

      try {
        for (; nextKind && !cancelled; nextKind = queuedKindRef.current) {
          const cycleKind = nextKind
          queuedKindRef.current = null

          const controller = new AbortController()
          abortRef.current = controller

          try {
            await refreshChangedFilesRef.current(controller.signal)
          } catch (error) {
            handleRefreshError(error, "files", controller.signal, onErrorRef.current, cancelled)
            break
          }

          if (cycleKind !== "git") {
            continue
          }

          try {
            await refreshBranchesRef.current(controller.signal)
          } catch (error) {
            handleRefreshError(error, "branches", controller.signal, onErrorRef.current, cancelled)
            break
          }
        }
      } finally {
        abortRef.current = null
        isRefreshingRef.current = false
        if (cancelled) {
          queuedKindRef.current = null
        }
      }
    }

    const unsubscribe = subscribeRepoEvents((event) => {
      void flushRefreshQueue(event.kind)
    })

    return () => {
      cancelled = true
      queuedKindRef.current = null
      abortRef.current?.abort()
      unsubscribe()
    }
  }, [])
}

function mergeRepoChangeKind(
  current: RepoChangedEvent["kind"] | null,
  next: RepoChangedEvent["kind"],
) {
  if (current === "git" || next === "git") {
    return "git"
  }

  return "worktree"
}

function handleRefreshError(
  error: unknown,
  phase: RefreshPhase,
  signal: AbortSignal,
  onError: UseRepoEventsRefreshOptions["onError"],
  cancelled: boolean,
) {
  if (cancelled || isAbortError(error)) {
    return
  }

  onError?.(toError(error), phase, signal)
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError"
}

function toError(error: unknown) {
  if (error instanceof Error) {
    return error
  }

  return new Error("Live refresh failed.")
}
