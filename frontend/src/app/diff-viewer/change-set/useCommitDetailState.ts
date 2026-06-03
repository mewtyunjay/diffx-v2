import { GitCommitHorizontal } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"

import { fetchCommitDetail, fetchCommitFileDiff } from "@/git/api"
import type { CommitDetailResult } from "@/git/types"
import type { ChangeSetDetail, ChangeSetFileDiffLoader } from "@/app/diff-viewer/change-set/types"

type UseCommitDetailStateOptions = {
  hash: string | null
}

const commitDateFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
})

function formatCommitDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ""
  }

  return commitDateFormatter.format(date)
}

function toChangeSetDetail(result: CommitDetailResult): ChangeSetDetail {
  const formattedDate = formatCommitDate(result.commit.authorDate)
  const meta = [
    { label: "Hash", value: result.commit.shortHash },
    { label: "Branch", value: result.currentRef || "HEAD" },
  ]

  if (formattedDate) {
    meta.push({ label: "Date", value: formattedDate })
  }

  return {
    kind: "commit",
    icon: GitCommitHorizontal,
    title: result.commit.subject || "(no subject)",
    subtitle: result.commit.hash,
    meta,
    files: result.files,
  }
}

export function useCommitDetailState({ hash }: UseCommitDetailStateOptions) {
  const [detailResult, setDetailResult] = useState<CommitDetailResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!hash) {
      queueMicrotask(() => {
        setDetailResult(null)
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

        setDetailResult(result)
      })
      .catch((requestError: Error) => {
        if (controller.signal.aborted) {
          return
        }

        setDetailResult(null)
        setError(requestError.message)
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      })

    return () => controller.abort()
  }, [hash])

  const detail = useMemo(
    () => (detailResult ? toChangeSetDetail(detailResult) : null),
    [detailResult]
  )

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
