import type { AnnotationSide, DiffLineAnnotation } from "@pierre/diffs/react"
import { useCallback, useMemo, useState } from "react"

import {
  createAnnotationTargetKey,
  createDraftDiffAnnotation,
  type DraftDiffAnnotation,
  type SavedDiffAnnotation,
} from "@/diff-viewer/annotations"
import type { PreparedFileDiffResult } from "@/diffs/create"

export type DraftTarget = {
  lineNumber: number
  side: AnnotationSide
}

export type RenderedAnnotationMetadata =
  | { kind: "draft" }
  | { kind: "saved"; comment: string }

type AnnotationDraftDiff = Pick<PreparedFileDiffResult, "path" | "previousPath" | "status">

type AnnotationTarget = Pick<SavedDiffAnnotation, "side" | "lineNumber">

type UseAnnotationDraftStateParams = {
  diff: AnnotationDraftDiff | null
  savedAnnotations: SavedDiffAnnotation[]
  onSaveAnnotation: (target: AnnotationTarget, comment: string) => void
  onDeleteAnnotation: (target: AnnotationTarget) => void
  initialDraft?: DraftDiffAnnotation | null
  onDraftChange?: (draft: DraftDiffAnnotation | null) => void
}

function isSameDraftTarget(a: DraftTarget | null, b: DraftTarget | null) {
  if (a == null || b == null) {
    return false
  }

  return a.lineNumber === b.lineNumber && a.side === b.side
}

export function useAnnotationDraftState({
  diff,
  savedAnnotations,
  onSaveAnnotation,
  onDeleteAnnotation,
  initialDraft = null,
  onDraftChange,
}: UseAnnotationDraftStateParams) {
  const [draft, setDraft] = useState<DraftDiffAnnotation | null>(() => initialDraft)

  const draftTarget = useMemo<DraftTarget | null>(
    () => (draft ? { lineNumber: draft.lineNumber, side: draft.side } : null),
    [draft]
  )
  const draftText = draft?.comment ?? ""

  const savedAnnotationMap = useMemo(
    () =>
      new Map(savedAnnotations.map((annotation) => [createAnnotationTargetKey(annotation), annotation])),
    [savedAnnotations]
  )

  const setStoredDraft = useCallback(
    (nextDraft: DraftDiffAnnotation | null) => {
      setDraft(nextDraft)
      onDraftChange?.(nextDraft)
    },
    [onDraftChange]
  )

  const openDraft = useCallback(
    (target: DraftTarget) => {
      if (isSameDraftTarget(draftTarget, target)) {
        setStoredDraft(null)
        return
      }

      if (!diff) {
        return
      }

      const existingAnnotation = savedAnnotationMap.get(createAnnotationTargetKey(target))
      setStoredDraft(createDraftDiffAnnotation(diff, target, existingAnnotation?.comment ?? ""))
    },
    [diff, draftTarget, savedAnnotationMap, setStoredDraft]
  )

  const lineAnnotations = useMemo<DiffLineAnnotation<RenderedAnnotationMetadata>[]>(() => {
    const draftKey = draftTarget ? createAnnotationTargetKey(draftTarget) : null
    const annotations: DiffLineAnnotation<RenderedAnnotationMetadata>[] = savedAnnotations
      .filter((annotation) => createAnnotationTargetKey(annotation) !== draftKey)
      .map((annotation) => ({
        side: annotation.side,
        lineNumber: annotation.lineNumber,
        metadata: { kind: "saved", comment: annotation.comment },
      }))

    if (draftTarget) {
      annotations.push({
        side: draftTarget.side,
        lineNumber: draftTarget.lineNumber,
        metadata: { kind: "draft" },
      })
    }

    return annotations
  }, [draftTarget, savedAnnotations])

  const isEditingExisting =
    draftTarget != null && savedAnnotationMap.has(createAnnotationTargetKey(draftTarget))

  const canSaveDraft = draftText.trim().length > 0 || isEditingExisting

  const focusKey = draftTarget == null ? "closed" : `${draftTarget.side}:${draftTarget.lineNumber}`

  const closeDraft = useCallback(() => setStoredDraft(null), [setStoredDraft])

  const changeDraft = useCallback(
    (value: string) => {
      if (!draftTarget || !diff) {
        return
      }

      setStoredDraft(createDraftDiffAnnotation(diff, draftTarget, value))
    },
    [diff, draftTarget, setStoredDraft]
  )

  const saveDraft = useCallback(() => {
    if (!draftTarget) {
      return
    }

    const trimmed = draftText.trim()
    if (trimmed.length === 0) {
      if (savedAnnotationMap.has(createAnnotationTargetKey(draftTarget))) {
        onDeleteAnnotation(draftTarget)
      }
      closeDraft()
      return
    }

    onSaveAnnotation(draftTarget, trimmed)
    closeDraft()
  }, [closeDraft, draftTarget, draftText, onDeleteAnnotation, onSaveAnnotation, savedAnnotationMap])

  const deleteDraft = useCallback(() => {
    if (!draftTarget) {
      return
    }

    onDeleteAnnotation(draftTarget)
    closeDraft()
  }, [closeDraft, draftTarget, onDeleteAnnotation])

  return {
    draftTarget,
    draftText,
    lineAnnotations,
    canSaveDraft,
    isEditingExisting,
    focusKey,
    openDraft,
    closeDraft,
    changeDraft,
    saveDraft,
    deleteDraft,
  }
}
