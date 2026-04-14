import { useCallback, useEffect, useRef, useState } from "react"

import {
  createSavedAnnotation,
  findPatchMetadataForAnnotation,
  formatSavedAnnotationsForCopy,
  getSavedAnnotationsForDiff,
  loadSavedAnnotations,
  persistSavedAnnotations,
  pruneSavedAnnotationsForDiff,
  pruneSavedAnnotationsForFiles,
  removeSavedAnnotation,
  upsertSavedAnnotation,
  type SavedDiffAnnotation,
} from "@/diff-viewer/annotations"
import { fetchReviewState, submitReviewFeedback } from "@/git/api"
import type { ChangedFileItem } from "@/git/types"
import type { PreparedFileDiffResult } from "@/diffs/create"
import { toast } from "@/components/ui/sonner"
import { getToastErrorDescription } from "@/lib/toast-errors"

type InlineAnnotationTarget = Pick<SavedDiffAnnotation, "side" | "lineNumber">

type UseAnnotationSessionOptions = {
  currentDiff: PreparedFileDiffResult | null
  selectedFile: Pick<ChangedFileItem, "contentKey"> | null
}

function getReviewStateError(reason: string) {
  switch (reason) {
    case "disabled":
      return "Send to agent is available only in review mode. Run `diffx review` from your agent."
    case "submitted":
      return "Feedback was already submitted for this review session."
    case "closed":
      return "The review session is closed."
    default:
      return "No active review session."
  }
}

export function useAnnotationSession({ currentDiff, selectedFile }: UseAnnotationSessionOptions) {
  const [savedAnnotations, setSavedAnnotations] = useState<SavedDiffAnnotation[]>(() =>
    loadSavedAnnotations()
  )
  const [copyState, setCopyState] = useState<"idle" | "copying" | "success" | "error">("idle")
  const [sendState, setSendState] = useState<"idle" | "sending" | "success" | "error">("idle")
  const [clearDraftToken, setClearDraftToken] = useState(0)
  const hasSavedAnnotations = savedAnnotations.length > 0

  const copyStateTimeoutRef = useRef<number | null>(null)
  const sendStateTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    persistSavedAnnotations(savedAnnotations)
  }, [savedAnnotations])

  useEffect(() => {
    return () => {
      if (copyStateTimeoutRef.current != null) {
        window.clearTimeout(copyStateTimeoutRef.current)
      }
      if (sendStateTimeoutRef.current != null) {
        window.clearTimeout(sendStateTimeoutRef.current)
      }
    }
  }, [])


  const resetCopyState = useCallback((nextState: "success" | "error") => {
    setCopyState(nextState)
    if (copyStateTimeoutRef.current != null) {
      window.clearTimeout(copyStateTimeoutRef.current)
    }

    copyStateTimeoutRef.current = window.setTimeout(() => {
      setCopyState("idle")
      copyStateTimeoutRef.current = null
    }, 2000)
  }, [])

  const resetSendState = useCallback((nextState: "success" | "error") => {
    setSendState(nextState)
    if (sendStateTimeoutRef.current != null) {
      window.clearTimeout(sendStateTimeoutRef.current)
    }

    sendStateTimeoutRef.current = window.setTimeout(() => {
      setSendState("idle")
      sendStateTimeoutRef.current = null
    }, 2000)
  }, [])

  const pruneForFiles = useCallback(
    (files: Pick<ChangedFileItem, "path" | "previousPath" | "status" | "contentKey">[]) => {
      setSavedAnnotations((currentAnnotations) =>
        pruneSavedAnnotationsForFiles(currentAnnotations, files)
      )
    },
    []
  )

  const pruneForDiff = useCallback(
    (diff: Pick<
      PreparedFileDiffResult,
      "path" | "previousPath" | "status" | "baseCommit" | "before" | "after"
    >) => {
      setSavedAnnotations((currentAnnotations) =>
        pruneSavedAnnotationsForDiff(currentAnnotations, diff)
      )
    },
    []
  )

  const saveAnnotation = useCallback(
    (target: InlineAnnotationTarget, comment: string) => {
      if (!selectedFile || !currentDiff) {
        return
      }

      const nextAnnotation = createSavedAnnotation({
        ...target,
        path: currentDiff.path,
        previousPath: currentDiff.previousPath,
        status: currentDiff.status,
        comment,
        contentKey: selectedFile.contentKey,
        baseRef: currentDiff.baseRef,
        baseCommit: currentDiff.baseCommit,
        beforeCacheKey: currentDiff.before.cacheKey,
        afterCacheKey: currentDiff.after.cacheKey,
        patchMetadata: findPatchMetadataForAnnotation(currentDiff, target),
      })

      if (!nextAnnotation) {
        return
      }

      setSavedAnnotations((currentAnnotations) =>
        upsertSavedAnnotation(currentAnnotations, nextAnnotation)
      )
    },
    [currentDiff, selectedFile]
  )

  const deleteAnnotation = useCallback(
    (target: InlineAnnotationTarget) => {
      if (!currentDiff) {
        return
      }

      setSavedAnnotations((currentAnnotations) =>
        removeSavedAnnotation(currentAnnotations, {
          ...target,
          path: currentDiff.path,
          previousPath: currentDiff.previousPath,
          status: currentDiff.status,
        })
      )
    },
    [currentDiff]
  )

  const copyAnnotations = useCallback(async () => {
    if (savedAnnotations.length === 0) {
      return
    }

    setCopyState("copying")

    try {
      await navigator.clipboard.writeText(formatSavedAnnotationsForCopy(savedAnnotations))
      setSavedAnnotations([])
      setClearDraftToken((current) => current + 1)
      resetCopyState("success")
    } catch {
      resetCopyState("error")
    }
  }, [resetCopyState, savedAnnotations])

  const sendAnnotations = useCallback(async () => {
    if (savedAnnotations.length === 0) {
      return
    }

    setSendState("sending")

    try {
      const reviewState = await fetchReviewState()
      if (!reviewState.acceptingFeedback) {
        toast.error("Couldn’t send feedback to agent.", {
          description: getReviewStateError(reviewState.reason),
        })
        resetSendState("error")
        return
      }

      const feedback = formatSavedAnnotationsForCopy(savedAnnotations)
      await submitReviewFeedback({
        approved: false,
        feedback,
        annotations: savedAnnotations,
      })
      setSavedAnnotations([])
      setClearDraftToken((current) => current + 1)
      resetSendState("success")
    } catch (error) {
      toast.error("Couldn’t send feedback to agent.", {
        description: getToastErrorDescription(error, "Unable to submit annotations to the active review session."),
      })
      resetSendState("error")
    }
  }, [resetSendState, savedAnnotations])

  const visibleSavedAnnotations = currentDiff
    ? getSavedAnnotationsForDiff(savedAnnotations, currentDiff)
    : []

  return {
    canCopyAnnotations: hasSavedAnnotations,
    canSendAnnotations: hasSavedAnnotations,
    clearDraftToken,
    copyAnnotations,
    copyState,
    deleteAnnotation,
    pruneForDiff,
    pruneForFiles,
    saveAnnotation,
    savedAnnotations,
    sendAnnotations,
    sendState,
    visibleSavedAnnotations,
  }
}
