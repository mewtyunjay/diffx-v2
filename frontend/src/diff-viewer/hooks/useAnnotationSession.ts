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
import type { ChangedFileItem, ReviewStateReason, ReviewStateResult } from "@/git/types"
import type { PreparedFileDiffResult } from "@/diffs/create"
import { toast } from "@/components/ui/sonner"
import { getToastErrorDescription } from "@/lib/toast-errors"

type InlineAnnotationTarget = Pick<SavedDiffAnnotation, "side" | "lineNumber">

type UseAnnotationSessionOptions = {
  currentDiff: PreparedFileDiffResult | null
  selectedFile: Pick<ChangedFileItem, "contentKey"> | null
}

const defaultReviewState: ReviewStateResult = {
  enabled: false,
  acceptingFeedback: false,
  submitted: false,
  closed: false,
  reason: "inactive",
}

function getSendDisabledReason(reason: ReviewStateReason) {
  switch (reason) {
    case "disabled":
      return "Send to agent is available only in review mode. Run `diffx review` from your agent."
    case "submitted":
      return "Feedback was already submitted for this review session."
    case "closed":
      return "The review session is closed."
    default:
      return "Waiting for an active review session."
  }
}

export function useAnnotationSession({ currentDiff, selectedFile }: UseAnnotationSessionOptions) {
  const [savedAnnotations, setSavedAnnotations] = useState<SavedDiffAnnotation[]>(() =>
    loadSavedAnnotations()
  )
  const [copyState, setCopyState] = useState<"idle" | "copying" | "success" | "error">("idle")
  const [sendState, setSendState] = useState<"idle" | "sending" | "success" | "error">("idle")
  const [reviewState, setReviewState] = useState<ReviewStateResult>(defaultReviewState)
  const [clearDraftToken, setClearDraftToken] = useState(0)
  const hasSavedAnnotations = savedAnnotations.length > 0
  const canSendAnnotations = hasSavedAnnotations && reviewState.acceptingFeedback
  const sendDisabledReason =
    hasSavedAnnotations && !canSendAnnotations ? getSendDisabledReason(reviewState.reason) : null

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

  useEffect(() => {
    let cancelled = false
    let controller = new AbortController()

    const refreshReviewState = async () => {
      controller.abort()
      controller = new AbortController()

      try {
        const nextState = await fetchReviewState(controller.signal)
        if (cancelled) {
          return
        }

        setReviewState(nextState)
      } catch (error) {
        if (cancelled) {
          return
        }
        if (error instanceof DOMException && error.name === "AbortError") {
          return
        }

        setReviewState(defaultReviewState)
      }
    }

    void refreshReviewState()
    const interval = window.setInterval(() => {
      void refreshReviewState()
    }, 5000)

    return () => {
      cancelled = true
      controller.abort()
      window.clearInterval(interval)
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
    if (!canSendAnnotations) {
      toast.error("Couldn’t send feedback to agent.", {
        description: sendDisabledReason ?? "Waiting for an active review session.",
      })
      return
    }

    setSendState("sending")

    try {
      const feedback = formatSavedAnnotationsForCopy(savedAnnotations)
      await submitReviewFeedback({
        approved: false,
        feedback,
        annotations: savedAnnotations,
      })
      setSavedAnnotations([])
      setReviewState((current) => ({
        ...current,
        acceptingFeedback: false,
        submitted: true,
        closed: true,
        reason: "submitted",
      }))
      setClearDraftToken((current) => current + 1)
      resetSendState("success")
    } catch (error) {
      toast.error("Couldn’t send feedback to agent.", {
        description: getToastErrorDescription(error, "Unable to submit annotations to the active review session."),
      })
      resetSendState("error")
    }
  }, [canSendAnnotations, resetSendState, savedAnnotations, sendDisabledReason])

  const visibleSavedAnnotations = currentDiff
    ? getSavedAnnotationsForDiff(savedAnnotations, currentDiff)
    : []

  return {
    canCopyAnnotations: hasSavedAnnotations,
    canSendAnnotations,
    sendDisabledReason,
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
