import { useCallback, useEffect, useState } from "react"

import { fetchCommitDetail, fetchCommitFileDiff } from "@/git/api"
import type { CommitDetailResult } from "@/git/types"
import type { ChangeSetFileDiffLoader } from "@/app/diff-viewer/change-set/types"

type UseCommitDetailStateOptions = {
  hash: string | null
}

export function useCommitDetailState({ hash }: UseCommitDetailStateOptions) {
  const [detail, setDetail] = useState<CommitDetailResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!hash) {
      queueMicrotask(() => {
        setDetail(null)
        setError(null)
        setIsLoading(false)
      })
      return
    }

    const controller = new AbortController()
    queueMicrotask(() => {
      if (controller.signal.aborted) {
        return
      }

      setIsLoading(true)
      setError(null)
    })

    fetchCommitDetail(hash, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) {
          return
        }

        setDetail(result)
      })
      .catch((requestError: Error) => {
        if (controller.signal.aborted) {
          return
        }

        setDetail(null)
        setError(requestError.message)
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      })

    return () => controller.abort()
  }, [hash])

  const loadFileDiff = useCallback<ChangeSetFileDiffLoader>(
    (file, signal) => {
      if (!hash) {
        return Promise.reject(new Error("No commit selected."))
      }

      return fetchCommitFileDiff(hash, file, signal)
    },
    [hash]
  )

  return {
    detail,
    error,
    isLoading,
    loadFileDiff,
  }
}
