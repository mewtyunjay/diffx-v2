import { useCallback, useEffect, useRef, useState } from "react"
import { useWorkerPool } from "@pierre/diffs/react"

import type { ChangedFileItem } from "@/git/types"
import {
  clonePreparedFileDiff,
  type PreparedFileDiffResult,
} from "@/diffs/create"
import { prepareFileDiffAsync } from "@/diffs/createAsync"
import type { ChangeSetFileDiffLoader } from "@/app/diff-viewer/change-set/types"

export type StackedDiffState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "loaded"; diff: PreparedFileDiffResult }
  | { status: "error"; error: string }

type UseStackedChangeSetDiffsOptions = {
  files: ChangedFileItem[]
  loadFileDiff: ChangeSetFileDiffLoader
  sourceKey: string
}

const EAGER_DIFF_COUNT = 3

export function createStackedDiffKey(
  sourceKey: string,
  file: Pick<ChangedFileItem, "path" | "previousPath" | "status">
) {
  return `${sourceKey}:${file.path}:${file.previousPath ?? ""}:${file.status}`
}

export function useStackedChangeSetDiffs({
  files,
  loadFileDiff,
  sourceKey,
}: UseStackedChangeSetDiffsOptions) {
  const workerPool = useWorkerPool()
  const [diffStates, setDiffStates] = useState<Record<string, StackedDiffState>>({})
  const cacheRef = useRef(new Map<string, PreparedFileDiffResult>())
  const requestRef = useRef(new Map<string, Promise<PreparedFileDiffResult>>())
  const abortsRef = useRef(new Map<string, AbortController>())
  const primedDiffHighlightKeysRef = useRef(new Set<string>())

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

  useEffect(() => {
    cacheRef.current.clear()
    requestRef.current.clear()
    primedDiffHighlightKeysRef.current.clear()
    for (const controller of abortsRef.current.values()) {
      controller.abort()
    }
    abortsRef.current.clear()
    queueMicrotask(() => {
      setDiffStates({})
    })
  }, [sourceKey])

  const ensureDiff = useCallback(
    (file: ChangedFileItem) => {
      const key = createStackedDiffKey(sourceKey, file)
      const cachedDiff = cacheRef.current.get(key)
      if (cachedDiff) {
        setDiffStates((current) => ({
          ...current,
          [key]: { status: "loaded", diff: clonePreparedFileDiff(cachedDiff) },
        }))
        return
      }

      if (requestRef.current.has(key)) {
        return
      }

      const controller = new AbortController()
      abortsRef.current.set(key, controller)
      setDiffStates((current) => ({
        ...current,
        [key]: { status: "loading" },
      }))

      const request = loadFileDiff(file, controller.signal)
        .then((result) => prepareFileDiffAsync(result))
        .then((preparedDiff) => {
          cacheRef.current.set(key, clonePreparedFileDiff(preparedDiff))
          primePreparedDiffHighlights(preparedDiff)

          if (!controller.signal.aborted) {
            setDiffStates((current) => ({
              ...current,
              [key]: { status: "loaded", diff: preparedDiff },
            }))
          }

          return preparedDiff
        })
        .catch((error: Error) => {
          if (!controller.signal.aborted) {
            setDiffStates((current) => ({
              ...current,
              [key]: { status: "error", error: error.message },
            }))
          }

          throw error
        })
        .finally(() => {
          requestRef.current.delete(key)
          abortsRef.current.delete(key)
        })

      request.catch(() => {
        // Errors are reflected per file so the stacked page can keep rendering.
      })
      requestRef.current.set(key, request)
    },
    [loadFileDiff, primePreparedDiffHighlights, sourceKey]
  )

  useEffect(() => {
    queueMicrotask(() => {
      files.slice(0, EAGER_DIFF_COUNT).forEach(ensureDiff)
    })
  }, [ensureDiff, files])

  return {
    diffStates,
    ensureDiff,
  }
}
