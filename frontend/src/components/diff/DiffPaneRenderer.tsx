import { diffAcceptRejectHunk, type FileDiffMetadata, type Hunk } from "@pierre/diffs"
import {
  FileDiff,
  type AnnotationSide,
  type DiffLineAnnotation,
  type DiffLineEventBaseProps,
} from "@pierre/diffs/react"
import { useCallback, useMemo, useState } from "react"

import {
  createAnnotationTargetKey,
  createDraftDiffAnnotation,
  type DraftDiffAnnotation,
  type SavedDiffAnnotation,
} from "@/app/diff-viewer/annotations"
import { DiffCommentDraft } from "@/components/diff/DiffCommentDraft"
import { DiffHunkActions } from "@/components/diff/DiffHunkActions"
import { DiffSavedComment } from "@/components/diff/DiffSavedComment"
import type { PreparedFileDiffResult } from "@/components/diff/prepareDiff"
import "@/components/diff/diff-pane-theme.css"

const DIFF_EXPANSION_LINE_COUNT = 20
const FAST_INLINE_DIFF_MAX_LINE_LENGTH = 300
const LARGE_DIFF_INLINE_DIFF_MAX_LINE_LENGTH = 120

type DraftTarget = {
  lineNumber: number
  side: AnnotationSide
}
type DiffLinePointerEvent = DiffLineEventBaseProps & { event: PointerEvent }

type RenderedAnnotationMetadata =
  | {
    kind: "draft"
  }
  | {
    kind: "saved"
    comment: string
  }
  | {
    kind: "hunk-actions"
    hunkIndex: number
  }

type RenderablePreparedDiff = PreparedFileDiffResult & {
  parsedDiff: NonNullable<PreparedFileDiffResult["parsedDiff"]>
}

type DiffPaneRendererProps = {
  diff: RenderablePreparedDiff
  initialDraft: DraftDiffAnnotation | null
  onDraftChange: (draft: DraftDiffAnnotation | null) => void
  viewMode: "split" | "unified"
  expandAll: boolean
  savedAnnotations: SavedDiffAnnotation[]
  onSaveAnnotation: (
    target: Pick<SavedDiffAnnotation, "side" | "lineNumber">,
    comment: string
  ) => void
  onDeleteAnnotation: (target: Pick<SavedDiffAnnotation, "side" | "lineNumber">) => void
}

function isSameDraftTarget(a: DraftTarget | null, b: DraftTarget | null) {
  if (a == null || b == null) {
    return false
  }

  return a.lineNumber === b.lineNumber && a.side === b.side
}

function computeHunkAnnotationTarget(hunk: Hunk): { side: AnnotationSide; lineNumber: number } | null {
  if (hunk.additionLines === 0 && hunk.deletionLines === 0) {
    return null
  }

  let additionLine = hunk.additionStart
  let deletionLine = hunk.deletionStart
  let lastAdditionEnd = -1
  let lastDeletionEnd = -1

  for (const content of hunk.hunkContent) {
    if (content.type === "context") {
      additionLine += content.lines.length
      deletionLine += content.lines.length
    } else {
      if (content.additions.length > 0) {
        lastAdditionEnd = additionLine + content.additions.length - 1
        additionLine += content.additions.length
      }
      if (content.deletions.length > 0) {
        lastDeletionEnd = deletionLine + content.deletions.length - 1
        deletionLine += content.deletions.length
      }
    }
  }

  if (lastAdditionEnd >= 0) {
    return { side: "additions", lineNumber: lastAdditionEnd }
  }
  if (lastDeletionEnd >= 0) {
    return { side: "deletions", lineNumber: lastDeletionEnd }
  }
  return null
}

function DiffPaneRendererContent({
  diff,
  initialDraft,
  onDraftChange,
  viewMode,
  expandAll,
  savedAnnotations,
  onSaveAnnotation,
  onDeleteAnnotation,
}: DiffPaneRendererProps) {
  const [draft, setDraft] = useState<DraftDiffAnnotation | null>(() => initialDraft)

  const draftTarget = useMemo(
    () =>
      draft
        ? {
            lineNumber: draft.lineNumber,
            side: draft.side,
          }
        : null,
    [draft]
  )
  const draftText = draft?.comment ?? ""

  const [activeDiff, setActiveDiff] = useState<FileDiffMetadata>(() => diff.parsedDiff)

  const handleHunkAction = useCallback(
    (hunkIndex: number, action: "accept" | "reject") => {
      setActiveDiff((current) => diffAcceptRejectHunk(current, hunkIndex, action))
    },
    []
  )

  const savedAnnotationMap = useMemo(
    () =>
      new Map(savedAnnotations.map((annotation) => [createAnnotationTargetKey(annotation), annotation])),
    [savedAnnotations]
  )

  const setStoredDraft = useCallback(
    (nextDraft: DraftDiffAnnotation | null) => {
      setDraft(nextDraft)
      onDraftChange(nextDraft)
    },
    [onDraftChange]
  )

  const handleOpenDraft = useCallback(
    (target: DraftTarget) => {
      if (isSameDraftTarget(draftTarget, target)) {
        setStoredDraft(null)
        return
      }

      const existingAnnotation = savedAnnotationMap.get(createAnnotationTargetKey(target))
      setStoredDraft(createDraftDiffAnnotation(diff, target, existingAnnotation?.comment ?? ""))
    },
    [diff, draftTarget, savedAnnotationMap, setStoredDraft]
  )

  const options = useMemo(
    () => ({
      diffStyle: viewMode,
      diffIndicators: "bars" as const,
      disableFileHeader: true,
      overflow: "wrap" as const,
      hunkSeparators: "line-info" as const,
      expandUnchanged: expandAll,
      expansionLineCount: DIFF_EXPANSION_LINE_COUNT,
      maxLineDiffLength: diff.isLargeDiff
        ? LARGE_DIFF_INLINE_DIFF_MAX_LINE_LENGTH
        : FAST_INLINE_DIFF_MAX_LINE_LENGTH,
      onLineNumberClick: (line: DiffLinePointerEvent) => {
        line.event.preventDefault()
        line.event.stopPropagation()
        handleOpenDraft({
          lineNumber: line.lineNumber,
          side: line.annotationSide,
        })
      },
    }),
    [diff.isLargeDiff, expandAll, handleOpenDraft, viewMode]
  )

  const lineAnnotations = useMemo<DiffLineAnnotation<RenderedAnnotationMetadata>[]>(
    () => {
      const draftKey = draftTarget ? createAnnotationTargetKey(draftTarget) : null
      const annotations: DiffLineAnnotation<RenderedAnnotationMetadata>[] = savedAnnotations
        .filter((annotation) => createAnnotationTargetKey(annotation) !== draftKey)
        .map((annotation) => ({
          side: annotation.side,
          lineNumber: annotation.lineNumber,
          metadata: {
            kind: "saved",
            comment: annotation.comment,
          },
        }))

      if (draftTarget) {
        annotations.push({
          side: draftTarget.side,
          lineNumber: draftTarget.lineNumber,
          metadata: {
            kind: "draft",
          },
        })
      }

      for (let i = 0; i < activeDiff.hunks.length; i++) {
        const target = computeHunkAnnotationTarget(activeDiff.hunks[i])
        if (target) {
          annotations.push({
            ...target,
            metadata: { kind: "hunk-actions", hunkIndex: i },
          })
        }
      }

      return annotations
    },
    [activeDiff.hunks, draftTarget, savedAnnotations]
  )

  const canSaveDraft = useMemo(() => {
    const trimmed = draftText.trim()
    return trimmed.length > 0 || (draftTarget != null && savedAnnotationMap.has(createAnnotationTargetKey(draftTarget)))
  }, [draftTarget, draftText, savedAnnotationMap])

  const handleCloseDraft = () => {
    setStoredDraft(null)
  }

  const handleSaveDraft = () => {
    if (!draftTarget) {
      return
    }

    const trimmed = draftText.trim()
    if (trimmed.length === 0) {
      if (savedAnnotationMap.has(createAnnotationTargetKey(draftTarget))) {
        onDeleteAnnotation(draftTarget)
      }
      handleCloseDraft()
      return
    }

    onSaveAnnotation(draftTarget, trimmed)
    handleCloseDraft()
  }

  const handleDeleteDraft = () => {
    if (!draftTarget) {
      return
    }

    onDeleteAnnotation(draftTarget)
    handleCloseDraft()
  }

  return (
    <FileDiff<RenderedAnnotationMetadata>
      fileDiff={activeDiff}
      options={options}
      lineAnnotations={lineAnnotations}
      renderAnnotation={(annotation) => {
        if (annotation.metadata?.kind === "hunk-actions") {
          return <DiffHunkActions hunkIndex={annotation.metadata.hunkIndex} onAction={handleHunkAction} />
        }

        if (annotation.metadata?.kind === "saved") {
          return <DiffSavedComment comment={annotation.metadata.comment} onOpen={() => handleOpenDraft(annotation)} />
        }

        const focusKey = draftTarget == null ? "closed" : `${draftTarget.side}:${draftTarget.lineNumber}`
        const isEditingExisting =
          draftTarget != null && savedAnnotationMap.has(createAnnotationTargetKey(draftTarget))

        return (
          <DiffCommentDraft
            focusKey={focusKey}
            value={draftText}
            canSave={canSaveDraft}
            isEditingExisting={isEditingExisting}
            onChange={(value) => {
              if (!draftTarget) {
                return
              }

              setStoredDraft(createDraftDiffAnnotation(diff, draftTarget, value))
            }}
            onDelete={isEditingExisting ? handleDeleteDraft : undefined}
            onSave={handleSaveDraft}
            onEscape={handleCloseDraft}
          />
        )
      }}
      className="diff-pane-theme block h-full min-h-full min-w-0"
    />
  )
}

export default function DiffPaneRenderer(props: DiffPaneRendererProps) {
  return <DiffPaneRendererContent {...props} />
}
