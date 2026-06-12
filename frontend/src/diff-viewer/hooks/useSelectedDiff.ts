import { useCallback, useEffect, useRef, useState } from "react"
import { useWorkerPool } from "@pierre/diffs/react"

import { fetchDiffForSource } from "@/git/api"
import type { ChangedFileItem, FileDiffResult } from "@/git/types"
import {
  clonePreparedFileDiff,
  type PreparedFileDiffResult,
} from "@/diffs/create"
import { prepareFileDiffAsync } from "@/diffs/createAsync"

function createDiffCacheKey(baseCommit: string, file: Pick<ChangedFileItem, "path" | "contentKey">) {
  return `${baseCommit}:${file.path}:${file.contentKey}`
}

type DiffSelectableFile = Pick<ChangedFileItem, "path" | "previousPath" | "status" | "contentKey">

type InitialDiffPreload = {
  file: Pick<ChangedFileItem, "path" | "contentKey">
  diff: FileDiffResult
}

type UseSelectedDiffOptions = {
  baseCommit: string
  selectedBaseRef: string
  selectedFile: DiffSelectableFile | null
  initialDiff?: FileDiffResult | null
  initialDiffs?: InitialDiffPreload[] | null
  onDiffLoaded?: (diff: PreparedFileDiffResult) => void
}

function matchesSelectedFileDiff(
  diff: FileDiffResult,
  baseCommit: string,
  file: DiffSelectableFile
) {
  return (
    diff.baseCommit === baseCommit &&
    diff.path === file.path &&
    (diff.previousPath ?? "") === (file.previousPath ?? "") &&
    diff.status === file.status
  )
}

export function useSelectedDiff({
  baseCommit,
  selectedBaseRef,
  selectedFile,
  initialDiff,
  initialDiffs,
  onDiffLoaded,
}: UseSelectedDiffOptions) {
  const workerPool = useWorkerPool()
  const [displayedDiff, setDisplayedDiff] = useState<PreparedFileDiffResult | null>(null)
  const [diffError, setDiffError] = useState<string | null>(null)
  const [isDiffLoading, setIsDiffLoading] = useState(false)

  const diffCacheRef = useRef(new Map<string, PreparedFileDiffResult>())
  const diffPrepareRequestCacheRef = useRef(new Map<string, Promise<PreparedFileDiffResult>>())
  const diffRequestCacheRef = useRef(new Map<string, Promise<PreparedFileDiffResult>>())
  const diffAbortRef = useRef<AbortController | null>(null)
  const primedDiffHighlightKeysRef = useRef(new Set<string>())

  const readCachedDiff = useCallback((cacheKey: string) => {
    const cachedDiff = diffCacheRef.current.get(cacheKey)
    if (!cachedDiff) {
      return null
    }

    return clonePreparedFileDiff(cachedDiff)
  }, [])

  const prepareLoadedDiff = useCallback(
    (
      nextBaseCommit: string,
      file: Pick<ChangedFileItem, "path" | "contentKey">,
      diff: FileDiffResult
    ) => {
      const cacheKey = createDiffCacheKey(nextBaseCommit, file)
      const cachedDiff = readCachedDiff(cacheKey)
      if (cachedDiff) {
        return Promise.resolve(cachedDiff)
      }

      const inFlightRequest = diffPrepareRequestCacheRef.current.get(cacheKey)
      if (inFlightRequest) {
        return inFlightRequest
      }

      const request = prepareFileDiffAsync(diff)
        .then((preparedDiff) => {
          diffCacheRef.current.set(cacheKey, clonePreparedFileDiff(preparedDiff))
          return preparedDiff
        })
        .finally(() => {
          diffPrepareRequestCacheRef.current.delete(cacheKey)
        })

      diffPrepareRequestCacheRef.current.set(cacheKey, request)

      return request
    },
    [readCachedDiff]
  )

  const primePreparedDiffHighlights = useCallback(
    (diff: PreparedFileDiffResult) => {
      const parsedDiffs = [diff.parsedDiff, diff.stagedParsedDiff].filter(
        (parsedDiff) => parsedDiff?.cacheKey
      )

      for (const parsedDiff of parsedDiffs) {
        if (!parsedDiff?.cacheKey || primedDiffHighlightKeysRef.current.has(parsedDiff.cacheKey)) {
          continue
        }

        primedDiffHighlightKeysRef.current.add(parsedDiff.cacheKey)
        workerPool?.primeDiffHighlightCache(parsedDiff)
      }
    },
    [workerPool]
  )

  const loadDiff = useCallback(
    (
      nextBaseRef: string,
      nextBaseCommit: string,
      file: Pick<ChangedFileItem, "path" | "previousPath" | "status" | "contentKey">,
      signal?: AbortSignal
    ) => {
      const cacheKey = createDiffCacheKey(nextBaseCommit, file)
      const cachedDiff = readCachedDiff(cacheKey)
      if (cachedDiff) {
        return Promise.resolve(cachedDiff)
      }

      const inFlightRequest = diffRequestCacheRef.current.get(cacheKey)
      if (inFlightRequest) {
        return inFlightRequest
      }

      const request = fetchDiffForSource({ kind: "working-tree", baseRef: nextBaseRef }, file, signal)
        .then((result) => prepareLoadedDiff(nextBaseCommit, file, result))
        .finally(() => {
          diffRequestCacheRef.current.delete(cacheKey)
        })

      diffRequestCacheRef.current.set(cacheKey, request)

      return request
    },
    [prepareLoadedDiff, readCachedDiff]
  )

  const currentDisplayedDiff =
    displayedDiff &&
    selectedFile &&
    displayedDiff.path === selectedFile.path &&
    (displayedDiff.previousPath ?? "") === (selectedFile.previousPath ?? "") &&
    displayedDiff.status === selectedFile.status
      ? displayedDiff
      : null

  useEffect(() => {
    if (!baseCommit || !initialDiffs || initialDiffs.length === 0) {
      return
    }

    let cancelled = false
    const preloadRequests = initialDiffs.map(({ file, diff }) =>
      prepareLoadedDiff(baseCommit, file, diff)
        .then((preparedDiff) => {
          if (!cancelled) {
            primePreparedDiffHighlights(preparedDiff)
          }
        })
        .catch(() => {
          // Individual preloads should not block the selected-file fallback path.
        })
    )

    void Promise.all(preloadRequests)

    return () => {
      cancelled = true
    }
  }, [baseCommit, initialDiffs, prepareLoadedDiff, primePreparedDiffHighlights])

  useEffect(() => {
    if (!selectedFile || !baseCommit) {
      diffAbortRef.current?.abort()
      return
    }

    diffAbortRef.current?.abort()

    const cacheKey = createDiffCacheKey(baseCommit, selectedFile)
    const cachedDiff = readCachedDiff(cacheKey)
    const preparedInitialDiffRequest =
      !cachedDiff && initialDiff && matchesSelectedFileDiff(initialDiff, baseCommit, selectedFile)
        ? prepareLoadedDiff(baseCommit, selectedFile, initialDiff)
        : null
    const controller = new AbortController()
    diffAbortRef.current = controller
    queueMicrotask(() => {
      if (controller.signal.aborted) {
        return
      }

      setDiffError(null)
    })

    if (!cachedDiff) {
      queueMicrotask(() => {
        if (controller.signal.aborted) {
          return
        }

        setIsDiffLoading(true)
      })
    }

    const inFlightPreparedDiff = diffPrepareRequestCacheRef.current.get(cacheKey)
    const request = cachedDiff
      ? Promise.resolve(cachedDiff)
      : preparedInitialDiffRequest
        ? preparedInitialDiffRequest
      : inFlightPreparedDiff ?? loadDiff(selectedBaseRef, baseCommit, selectedFile, controller.signal)

    request
      .then((result) => {
        if (controller.signal.aborted) {
          return
        }

        setDisplayedDiff(result)
        setIsDiffLoading(false)
        primePreparedDiffHighlights(result)
        onDiffLoaded?.(result)
      })
      .catch((error: Error) => {
        if (controller.signal.aborted) {
          return
        }

        setDisplayedDiff(null)
        setDiffError(error.message)
        setIsDiffLoading(false)
      })

    return () => controller.abort()
  }, [
    baseCommit,
    initialDiff,
    loadDiff,
    onDiffLoaded,
    prepareLoadedDiff,
    primePreparedDiffHighlights,
    readCachedDiff,
    selectedBaseRef,
    selectedFile,
  ])

  return {
    currentDisplayedDiff,
    diffError,
    isDiffLoading,
  }
}
