import { useCallback, useEffect, useState } from "react"

import type { ChangeSetFileDiffLoader } from "@/app/diff-viewer/change-set/types"
import { fetchPullRequestDetail, fetchPullRequestFileDiff } from "@/git/api"
import type { PullRequestDetailResult } from "@/git/types"

type UsePullRequestDetailStateOptions = {
  number: number | null
}

export function usePullRequestDetailState({ number }: UsePullRequestDetailStateOptions) {
  const [detail, setDetail] = useState<PullRequestDetailResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const refresh = useCallback(async (signal?: AbortSignal) => {
    if (number == null) {
      setDetail(null)
      setError(null)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const result = await fetchPullRequestDetail(number, signal)
      if (signal?.aborted) {
        return
      }

      setDetail(result)
    } catch (requestError) {
      if (signal?.aborted) {
        return
      }

      setDetail(null)
      setError(requestError instanceof Error ? requestError.message : "Unable to load pull request.")
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false)
      }
    }
  }, [number])

  useEffect(() => {
    if (number == null) {
      queueMicrotask(() => {
        setDetail(null)
        setError(null)
        setIsLoading(false)
      })
      return
    }

    const controller = new AbortController()
    void refresh(controller.signal)

    return () => controller.abort()
  }, [number, refresh])

  const loadFileDiff = useCallback<ChangeSetFileDiffLoader>(
    (file, signal) => {
      if (number == null) {
        return Promise.reject(new Error("No pull request selected."))
      }

      return fetchPullRequestFileDiff(number, file, signal)
    },
    [number]
  )

  return {
    detail,
    error,
    isLoading,
    refresh,
    loadFileDiff,
  }
}
