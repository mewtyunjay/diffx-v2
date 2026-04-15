import { useCallback, useEffect, useMemo, useState } from "react"

import { fetchConflictFile, resolveConflictFile } from "@/git/api"
import type {
  ChangedFileItem,
  ConflictFileResult,
  MergeState,
} from "@/git/types"
import { toast } from "@/components/ui/sonner"
import { getToastErrorDescription } from "@/lib/toast-errors"

type MergeViewerMode = "normal" | "conflicts"

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

  const conflictedFiles = useMemo(
    () => files.filter((file) => file.status === "conflicted"),
    [files]
  )

  useEffect(() => {
    if (!mergeState.inProgress) {
      setMergeViewMode("normal")
      return
    }

    if (mergeState.unresolvedCount > 0) {
      setMergeViewMode("conflicts")
    }
  }, [mergeState.inProgress, mergeState.unresolvedCount])

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

  const showMergeResolvedState =
    isConflictMode && mergeState.inProgress && mergeState.unresolvedCount === 0

  const returnToNormalMode = useCallback(() => {
    setMergeViewMode("normal")
  }, [])

  return {
    conflictedFiles,
    conflictFile,
    conflictFileError,
    isConflictFileLoading,
    isConflictMode,
    isResolvePending,
    mergeViewMode,
    returnToNormalMode,
    resolveSelectedConflict,
    selectedConflictPath,
    showMergeResolvedState,
    visibleFiles,
  }
}
