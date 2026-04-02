import { FileDiff, type AnnotationSide, type DiffLineAnnotation } from "@pierre/diffs/react"
import { Plus } from "lucide-react"
import { useMemo, useState, type CSSProperties } from "react"

import type { SavedDiffAnnotation } from "@/app/diff-viewer/annotations"
import { DiffCommentDraft } from "@/components/diff/DiffCommentDraft"
import { DiffSavedComment } from "@/components/diff/DiffSavedComment"
import type { PreparedFileDiffResult } from "@/components/diff/prepareDiff"

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

function DiffPaneRendererContent({
  diff,
  viewMode,
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
      overflow: "scroll" as const,
      hunkSeparators: "line-info" as const,
      expandUnchanged: false,
      enableHoverUtility: true,
      expansionLineCount: DIFF_EXPANSION_LINE_COUNT,
      maxLineDiffLength: diff.isLargeDiff
        ? LARGE_DIFF_INLINE_DIFF_MAX_LINE_LENGTH
        : FAST_INLINE_DIFF_MAX_LINE_LENGTH,
    }),
    [diff.isLargeDiff, viewMode]
  )

  const diffStyles = useMemo(
    () =>
      ({
        "--diffs-font-family":
          '"JetBrains Mono", "SFMono-Regular", "SF Mono", "Cascadia Code", "Roboto Mono", monospace',
        "--diffs-font-size": "14px",
        "--diffs-line-height": "1.5",
        "--diffs-font-features": "normal",
        "--diffs-header-font-family": '"Instrument Sans", "Segoe UI", system-ui, sans-serif',
      }) as CSSProperties,
    []
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

  return (
    <FileDiff<RenderedAnnotationMetadata>
      fileDiff={diff.parsedDiff}
      options={options}
      style={diffStyles}
      lineAnnotations={lineAnnotations}
      renderAnnotation={(annotation) => {
        if (annotation.metadata?.kind === "saved") {
          return <DiffSavedComment comment={annotation.metadata.comment} />
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
            onSave={handleSaveDraft}
            onEscape={handleCloseDraft}
          />
        )
      }}
      renderHoverUtility={(getHoveredLine) => (
        <button
          type="button"
          aria-label="Add inline comment"
          className="pointer-events-auto z-10 inline-flex items-center justify-center -translate-x-1.5 rounded-md text-foreground"
          style={{
            width: "1.5rem",
            height: "1.5rem",
            marginTop: "calc((1lh - 1.5rem) / 2)",
            border: "1px solid var(--border)",
            background: "var(--popover)",
            boxShadow: "0 6px 14px rgba(0, 0, 0, 0.28)",
            opacity: 1,
          }}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()

            const hoveredLine = getHoveredLine() as HoveredDiffLine | undefined
            if (!hoveredLine) {
              return
            }

            setOpenDraft((currentDraft) => {
              if (isSameDraftTarget(currentDraft, hoveredLine)) {
                setDraftText("")
                return null
              }

              const existingAnnotation = savedAnnotationMap.get(createAnnotationLookupKey(hoveredLine))
              setDraftText(existingAnnotation?.comment ?? "")
              return hoveredLine
            })
          }}
        >
          <Plus className="size-3.5" />
        </button>
      )}
      className="block h-full min-h-full min-w-0 font-mono"
    />
  )
}

export default function DiffPaneRenderer(props: DiffPaneRendererProps) {
  return <DiffPaneRendererContent {...props} />
}
