import { FileDiff, type AnnotationSide, type DiffLineAnnotation } from "@pierre/diffs/react"
import { Plus } from "lucide-react"
import { useMemo, useState, type Dispatch, type SetStateAction } from "react"

import type { SavedDiffAnnotation } from "@/app/diff-viewer/annotations"
import { DiffCommentDraft } from "@/components/diff/DiffCommentDraft"
import { DiffSavedComment } from "@/components/diff/DiffSavedComment"
import type { PreparedFileDiffResult } from "@/components/diff/prepareDiff"
import "@/components/diff/diff-pane-theme.css"

const DIFF_EXPANSION_LINE_COUNT = 20
const FAST_INLINE_DIFF_MAX_LINE_LENGTH = 300
const LARGE_DIFF_INLINE_DIFF_MAX_LINE_LENGTH = 120

type HoveredDiffLine = {
  lineNumber: number
  side: AnnotationSide
}

type DraftTarget = HoveredDiffLine

type RenderedAnnotationMetadata =
  | {
    kind: "draft"
  }
  | {
    kind: "saved"
    comment: string
  }

type RenderablePreparedDiff = PreparedFileDiffResult & {
  parsedDiff: NonNullable<PreparedFileDiffResult["parsedDiff"]>
}

type DiffPaneRendererProps = {
  diff: RenderablePreparedDiff
  viewMode: "split" | "unified"
  expandAll: boolean
  savedAnnotations: SavedDiffAnnotation[]
  onSaveAnnotation: (
    target: Pick<SavedDiffAnnotation, "side" | "lineNumber">,
    comment: string
  ) => void
  onDeleteAnnotation: (target: Pick<SavedDiffAnnotation, "side" | "lineNumber">) => void
}

function createAnnotationLookupKey(target: DraftTarget) {
  return `${target.side}:${target.lineNumber}`
}

function isSameDraftTarget(a: DraftTarget | null, b: DraftTarget | null) {
  if (a == null || b == null) {
    return false
  }

  return a.lineNumber === b.lineNumber && a.side === b.side
}

function openAnnotationDraft(
  target: DraftTarget,
  savedAnnotationMap: Map<string, SavedDiffAnnotation>,
  setDraftText: (value: string) => void,
  setOpenDraft: Dispatch<SetStateAction<DraftTarget | null>>
) {
  const existingAnnotation = savedAnnotationMap.get(createAnnotationLookupKey(target))
  setDraftText(existingAnnotation?.comment ?? "")
  setOpenDraft(target)
}

function DiffPaneRendererContent({
  diff,
  viewMode,
  expandAll,
  savedAnnotations,
  onSaveAnnotation,
  onDeleteAnnotation,
}: DiffPaneRendererProps) {
  const [openDraft, setOpenDraft] = useState<DraftTarget | null>(null)
  const [draftText, setDraftText] = useState("")

  const options = useMemo(
    () => ({
      diffStyle: viewMode,
      diffIndicators: "bars" as const,
      disableFileHeader: true,
      overflow: "wrap" as const,
      hunkSeparators: "line-info" as const,
      expandUnchanged: expandAll,
      enableHoverUtility: true,
      expansionLineCount: DIFF_EXPANSION_LINE_COUNT,
      maxLineDiffLength: diff.isLargeDiff
        ? LARGE_DIFF_INLINE_DIFF_MAX_LINE_LENGTH
        : FAST_INLINE_DIFF_MAX_LINE_LENGTH,
    }),
    [diff.isLargeDiff, expandAll, viewMode]
  )

  const savedAnnotationMap = useMemo(
    () =>
      new Map(savedAnnotations.map((annotation) => [createAnnotationLookupKey(annotation), annotation])),
    [savedAnnotations]
  )

  const lineAnnotations = useMemo<DiffLineAnnotation<RenderedAnnotationMetadata>[]>(
    () => {
      const draftKey = openDraft ? createAnnotationLookupKey(openDraft) : null
      const annotations: DiffLineAnnotation<RenderedAnnotationMetadata>[] = savedAnnotations
        .filter((annotation) => createAnnotationLookupKey(annotation) !== draftKey)
        .map((annotation) => ({
          side: annotation.side,
          lineNumber: annotation.lineNumber,
          metadata: {
            kind: "saved",
            comment: annotation.comment,
          },
        }))

      if (openDraft) {
        annotations.push({
          side: openDraft.side,
          lineNumber: openDraft.lineNumber,
          metadata: {
            kind: "draft",
          },
        })
      }

      return annotations
    },
    [openDraft, savedAnnotations]
  )

  const canSaveDraft = useMemo(() => {
    const trimmed = draftText.trim()
    return trimmed.length > 0 || (openDraft != null && savedAnnotationMap.has(createAnnotationLookupKey(openDraft)))
  }, [draftText, openDraft, savedAnnotationMap])

  const handleCloseDraft = () => {
    setOpenDraft(null)
    setDraftText("")
  }

  const handleSaveDraft = () => {
    if (!openDraft) {
      return
    }

    const trimmed = draftText.trim()
    if (trimmed.length === 0) {
      if (savedAnnotationMap.has(createAnnotationLookupKey(openDraft))) {
        onDeleteAnnotation(openDraft)
      }
      handleCloseDraft()
      return
    }

    onSaveAnnotation(openDraft, trimmed)
    handleCloseDraft()
  }

  const handleDeleteDraft = () => {
    if (!openDraft) {
      return
    }

    onDeleteAnnotation(openDraft)
    handleCloseDraft()
  }

  const handleOpenDraft = (target: DraftTarget) => {
    if (isSameDraftTarget(openDraft, target)) {
      setDraftText("")
      setOpenDraft(null)
      return
    }

    openAnnotationDraft(target, savedAnnotationMap, setDraftText, setOpenDraft)
  }

  return (
    <FileDiff<RenderedAnnotationMetadata>
      fileDiff={diff.parsedDiff}
      options={options}
      lineAnnotations={lineAnnotations}
      renderAnnotation={(annotation) => {
        if (annotation.metadata?.kind === "saved") {
          return (
            <DiffSavedComment
              comment={annotation.metadata.comment}
              onOpen={() =>
                handleOpenDraft(annotation)
              }
            />
          )
        }

        const draftKey = openDraft == null ? "closed" : `${openDraft.side}:${openDraft.lineNumber}`
        const isEditingExisting =
          openDraft != null && savedAnnotationMap.has(createAnnotationLookupKey(openDraft))

        return (
          <DiffCommentDraft
            focusKey={draftKey}
            value={draftText}
            canSave={canSaveDraft}
            isEditingExisting={isEditingExisting}
            onChange={setDraftText}
            onDelete={isEditingExisting ? handleDeleteDraft : undefined}
            onSave={handleSaveDraft}
            onEscape={handleCloseDraft}
          />
        )
      }}
      renderHoverUtility={(getHoveredLine) => (
        <button
          type="button"
          aria-label="Add or edit annotation"
          className="diff-pane-hover-utility pointer-events-auto z-10 inline-flex items-center justify-center -translate-x-1.5 rounded-md text-foreground"
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()

            const hoveredLine = getHoveredLine() as HoveredDiffLine | undefined
            if (!hoveredLine) {
              return
            }

            handleOpenDraft(hoveredLine)
          }}
        >
          <Plus className="size-3.5" />
        </button>
      )}
      className="diff-pane-theme block h-full min-h-full min-w-0"
    />
  )
}

export default function DiffPaneRenderer(props: DiffPaneRendererProps) {
  return <DiffPaneRendererContent {...props} />
}
