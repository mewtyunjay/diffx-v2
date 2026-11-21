import { useCallback, useEffect, useRef, useState } from "react"

import { fetchPullRequests } from "@/git/api"
import type { PullRequestFilter, PullRequestsResult } from "@/git/types"

type ListSnapshot = {
  result?: PullRequestsResult
  error?: string
  isLoading?: boolean
}

export function usePullRequestsState({ enabled, filter }: {
  enabled: boolean
  filter: PullRequestFilter
}) {
  const [snapshots, setSnapshots] = useState<Partial<Record<PullRequestFilter, ListSnapshot>>>({})
  const requests = useRef<Partial<Record<PullRequestFilter, AbortController>>>({})
  const snapshot = snapshots[filter]

  const refresh = useCallback(async () => {
    requests.current[filter]?.abort()
    const controller = new AbortController()
    requests.current[filter] = controller
    setSnapshots((current) => ({
      ...current,
      [filter]: { result: current[filter]?.result, isLoading: true },
    }))

    try {
      const result = await fetchPullRequests(filter, controller.signal)
      if (controller.signal.aborted) return
      setSnapshots((current) => ({ ...current, [filter]: { result } }))
    } catch (requestError) {
      if (controller.signal.aborted) return
      const error = requestError instanceof Error ? requestError.message : "Unable to load pull requests."
      setSnapshots((current) => ({ ...current, [filter]: { error } }))
    } finally {
      if (requests.current[filter] === controller) delete requests.current[filter]
    }
  }, [filter])

  useEffect(() => {
    if (enabled) void refresh()
  }, [enabled, refresh])

  useEffect(() => {
    return () => {
      for (const controller of Object.values(requests.current)) controller.abort()
      requests.current = {}
    }
  }, [])

  return {
    repo: snapshot?.result?.repo ?? null,
    prs: snapshot?.result?.prs ?? [],
    state: snapshot?.result?.state ?? null,
    error: snapshot?.error ?? null,
    isLoading: enabled && (!snapshot || snapshot.isLoading === true),
    refresh,
  }
}
