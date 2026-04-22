import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { fetchConflictFile, resolveConflictFile } from "@/git/api"
import type {
  ChangedFileItem,
  ConflictFileResult,
  MergeState,
} from "@/git/types"
import { toast } from "@/components/ui/sonner"
import { getToastErrorDescription } from "@/lib/toast-errors"

type MergeViewerMode = "normal" | "conflicts"
type ConflictProgress = {
  remainingCount: number
  resolvedCount: number
  totalCount: number
}

type UseMergeConflictStateOptions = {
  files: ChangedFileItem[]
  mergeState: MergeState
  selectedFilePath: string | null
  setSelectedFilePath: (path: string | null) => void
  refreshChangedFiles: (signal?: AbortSignal) => Promise<unknown>
}

export function useMergeConflictState({
  files,
  mergeState,
  selectedFilePath,
  setSelectedFilePath,
  refreshChangedFiles,
}: UseMergeConflictStateOptions) {
  const [mergeViewMode, setMergeViewMode] = useState<MergeViewerMode>("normal")
  const [conflictFile, setConflictFile] = useState<ConflictFileResult | null>(null)
  const [conflictFileError, setConflictFileError] = useState<string | null>(null)
  const [isConflictFileLoading, setIsConflictFileLoading] = useState(false)
  const [isResolvePending, setIsResolvePending] = useState(false)
  const [conflictInitialTotalsByPath, setConflictInitialTotalsByPath] = useState<Record<string, number>>({})
  const wasMergeInProgressRef = useRef(false)

  const conflictedFiles = useMemo(
    () => files.filter((file) => file.status === "conflicted"),
    [files]
  )

  useEffect(() => {
    if (!mergeState.inProgress) {
      setMergeViewMode("normal")
      setConflictInitialTotalsByPath({})
      wasMergeInProgressRef.current = false
      return
    }

    if (!wasMergeInProgressRef.current && mergeState.unresolvedCount > 0) {
      setMergeViewMode("conflicts")
    }

    wasMergeInProgressRef.current = true
  }, [mergeState.inProgress, mergeState.unresolvedCount])

  useEffect(() => {
    if (!mergeState.inProgress) {
      return
    }

    setConflictInitialTotalsByPath((current) => {
      const activePaths = new Set(conflictedFiles.map((file) => file.path))
      let next = current
      let didChange = false

      for (const file of conflictedFiles) {
        const remainingCount = Math.max(file.conflictBlocksRemaining ?? 0, 0)
        const knownInitialCount = next[file.path]
        const nextInitialCount =
          knownInitialCount == null ? remainingCount : Math.max(knownInitialCount, remainingCount)
        if (knownInitialCount === nextInitialCount) {
          continue
        }

        if (!didChange) {
          next = { ...next }
          didChange = true
        }

        next[file.path] = nextInitialCount
      }

      for (const path of Object.keys(next)) {
        if (activePaths.has(path)) {
          continue
        }

        if (!didChange) {
          next = { ...next }
          didChange = true
        }

        delete next[path]
      }

      return didChange ? next : current
    })
  }, [conflictedFiles, mergeState.inProgress])

  const isConflictMode = mergeState.inProgress && mergeViewMode === "conflicts"
  const visibleFiles = isConflictMode ? conflictedFiles : files

  useEffect(() => {
    if (selectedFilePath && visibleFiles.some((file) => file.path === selectedFilePath)) {
      return
    }

    setSelectedFilePath(visibleFiles[0]?.path ?? null)
  }, [selectedFilePath, setSelectedFilePath, visibleFiles])

  const selectedConflictPath = useMemo(() => {
    if (!isConflictMode) {
      return null
    }

    if (selectedFilePath && conflictedFiles.some((file) => file.path === selectedFilePath)) {
      return selectedFilePath
    }

    return conflictedFiles[0]?.path ?? null
  }, [conflictedFiles, isConflictMode, selectedFilePath])

  useEffect(() => {
    if (!isConflictMode || !selectedConflictPath) {
      setConflictFile(null)
      setConflictFileError(null)
      setIsConflictFileLoading(false)
      return
    }

    const controller = new AbortController()
    setIsConflictFileLoading(true)
    setConflictFileError(null)

    fetchConflictFile(selectedConflictPath, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) {
          return
        }

        setConflictFile(result)
      })
      .catch((error: Error) => {
        if (controller.signal.aborted) {
          return
        }

        setConflictFile(null)
        setConflictFileError(error.message)
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsConflictFileLoading(false)
        }
      })

    return () => controller.abort()
  }, [isConflictMode, selectedConflictPath])

  const resolveSelectedConflict = useCallback(
    async (contents: string) => {
      if (!selectedConflictPath) {
        return
      }

      setIsResolvePending(true)
      try {
        const result = await resolveConflictFile(selectedConflictPath, contents)
        setConflictFile((current) => {
          if (!current || current.path !== selectedConflictPath) {
            return current
          }

          return {
            ...current,
            contents,
            contentKey: result.contentKey,
          }
        })

        await refreshChangedFiles()
      } catch (error) {
        toast.error("Couldn’t apply conflict resolution.", {
          description: getToastErrorDescription(error, "Unable to write the resolved file."),
        })
      } finally {
        setIsResolvePending(false)
      }
    },
    [refreshChangedFiles, selectedConflictPath]
  )

  const showMergeResolvedState = mergeState.inProgress && mergeState.unresolvedCount === 0

  const conflictProgressByPath = useMemo<Record<string, ConflictProgress>>(() => {
    const next: Record<string, ConflictProgress> = {}
    for (const file of conflictedFiles) {
      const remainingCount = Math.max(file.conflictBlocksRemaining ?? 0, 0)
      const initialCount = conflictInitialTotalsByPath[file.path]
      const totalCount =
        initialCount == null ? remainingCount : Math.max(initialCount, remainingCount)

      next[file.path] = {
        remainingCount,
        resolvedCount: Math.max(totalCount - remainingCount, 0),
        totalCount,
      }
    }

    return next
  }, [conflictInitialTotalsByPath, conflictedFiles])

  const getConflictProgressLabel = useCallback(
    (path: string) => {
      const progress = conflictProgressByPath[path]
      if (!progress || progress.totalCount <= 0) {
        return null
      }

      return `${progress.resolvedCount}/${progress.totalCount} resolved`
    },
    [conflictProgressByPath]
  )

  const showAllFiles = useCallback(() => {
    setMergeViewMode("normal")
  }, [])

  const showConflicts = useCallback(() => {
    setMergeViewMode("conflicts")
  }, [])

  return {
    conflictedFiles,
    conflictFile,
    conflictFileError,
    getConflictProgressLabel,
    isConflictFileLoading,
    isConflictMode,
    isResolvePending,
    mergeViewMode,
    showAllFiles,
    showConflicts,
    resolveSelectedConflict,
    selectedConflictPath,
    showMergeResolvedState,
    visibleFiles,
  }
}
