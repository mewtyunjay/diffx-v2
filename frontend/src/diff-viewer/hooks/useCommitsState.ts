import { useCallback, useEffect, useRef, useState } from "react"

import { fetchCommits } from "@/git/api"
import type { CommitItem } from "@/git/types"

type UseCommitsStateOptions = {
  enabled: boolean
  currentRef: string
}

const commitPageSize = 80

export function useCommitsState({ enabled, currentRef }: UseCommitsStateOptions) {
  const [commits, setCommits] = useState<CommitItem[]>([])
  const [commitsError, setCommitsError] = useState<string | null>(null)
  const [isCommitsLoading, setIsCommitsLoading] = useState(false)
  const [hasMoreCommits, setHasMoreCommits] = useState(false)
  const nextOffsetRef = useRef(0)
  const hasMoreRef = useRef(false)
  const isLoadingRef = useRef(false)
  const activeRequestRef = useRef(0)

  const loadCommitPage = useCallback(async (offset: number, signal?: AbortSignal) => {
    if (isLoadingRef.current && offset !== 0) {
      return null
    }

    const requestID = activeRequestRef.current + 1
    activeRequestRef.current = requestID
    isLoadingRef.current = true
    setIsCommitsLoading(true)
    try {
      const result = await fetchCommits(commitPageSize, offset, signal)
      if (signal?.aborted || activeRequestRef.current !== requestID) {
        return result
      }

      setCommits((currentCommits) =>
        offset === 0 ? result.commits : [...currentCommits, ...result.commits]
      )
      setCommitsError(null)
      setHasMoreCommits(result.hasMore)
      hasMoreRef.current = result.hasMore
      nextOffsetRef.current = result.nextOffset
      return result
    } catch (error) {
      if (!signal?.aborted && activeRequestRef.current === requestID) {
        if (offset === 0) {
          setCommits([])
          setHasMoreCommits(false)
        }
        setCommitsError(error instanceof Error ? error.message : "Unable to load commits.")
      }
      return null
    } finally {
      if (activeRequestRef.current === requestID) {
        isLoadingRef.current = false
        setIsCommitsLoading(false)
      }
    }
  }, [])

  const refreshCommits = useCallback(
    async (signal?: AbortSignal) => {
      nextOffsetRef.current = 0
      hasMoreRef.current = false
      setHasMoreCommits(false)
      return loadCommitPage(0, signal)
    },
    [loadCommitPage]
  )

  const loadMoreCommits = useCallback(async () => {
    if (!hasMoreRef.current) {
      return
    }

    await loadCommitPage(nextOffsetRef.current)
  }, [loadCommitPage])

  useEffect(() => {
    if (!enabled) {
      return
    }

    const controller = new AbortController()
    void refreshCommits(controller.signal)

    return () => controller.abort()
  }, [currentRef, enabled, refreshCommits])

  return {
    commits,
    commitsError,
    hasMoreCommits,
    isCommitsLoading,
    loadMoreCommits,
  }
}
