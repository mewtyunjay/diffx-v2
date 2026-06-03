import { useCallback, useEffect, useState } from "react"

import { fetchCommits } from "@/git/api"
import type { CommitItem } from "@/git/types"

type UseCommitsStateOptions = {
  enabled: boolean
  currentRef: string
}

export function useCommitsState({ enabled, currentRef }: UseCommitsStateOptions) {
  const [commits, setCommits] = useState<CommitItem[]>([])
  const [commitsError, setCommitsError] = useState<string | null>(null)
  const [isCommitsLoading, setIsCommitsLoading] = useState(false)

  const refreshCommits = useCallback(async (signal?: AbortSignal) => {
    const result = await fetchCommits(100, signal)
    setCommits(result.commits)
    setCommitsError(null)
    return result
  }, [])

  const loadCommits = useCallback(
    async (signal: AbortSignal) => {
      setIsCommitsLoading(true)

      try {
        await refreshCommits(signal)
      } catch (error) {
        if (signal.aborted) {
          return
        }

        setCommits([])
        setCommitsError(error instanceof Error ? error.message : "Unable to load commits.")
      } finally {
        if (!signal.aborted) {
          setIsCommitsLoading(false)
        }
      }
    },
    [refreshCommits]
  )

  useEffect(() => {
    if (!enabled) {
      return
    }

    const controller = new AbortController()
    void loadCommits(controller.signal)

    return () => controller.abort()
  }, [currentRef, enabled, loadCommits])

  return {
    commits,
    commitsError,
    isCommitsLoading,
    refreshCommits,
    setCommitsError,
  }
}
