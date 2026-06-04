import { useCallback, useEffect, useState } from "react"

import { fetchPullRequests } from "@/git/api"
import type {
  GitHubIntegrationState,
  GitHubRepository,
  PullRequestListItem,
} from "@/git/types"

type UsePullRequestsStateOptions = {
  enabled: boolean
}

export function usePullRequestsState({ enabled }: UsePullRequestsStateOptions) {
  const [repo, setRepo] = useState<GitHubRepository | null>(null)
  const [prs, setPRs] = useState<PullRequestListItem[]>([])
  const [state, setState] = useState<GitHubIntegrationState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)

  const refresh = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true)
    setError(null)

    try {
      const result = await fetchPullRequests(signal)
      if (signal?.aborted) {
        return
      }

      setRepo(result.repo)
      setPRs(result.prs)
      setState(result.state)
      setHasLoaded(true)
    } catch (requestError) {
      if (signal?.aborted) {
        return
      }

      setError(requestError instanceof Error ? requestError.message : "Unable to load pull requests.")
      setHasLoaded(true)
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    if (!enabled || hasLoaded) {
      return
    }

    const controller = new AbortController()
    void refresh(controller.signal)

    return () => controller.abort()
  }, [enabled, hasLoaded, refresh])

  return {
    repo,
    prs,
    state,
    error,
    isLoading,
    hasLoaded,
    refresh,
  }
}
