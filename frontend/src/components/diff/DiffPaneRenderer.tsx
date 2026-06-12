import { FileDiff, type DiffLineEventBaseProps } from "@pierre/diffs/react"
import { useCallback, useMemo, useRef, type MouseEvent as ReactMouseEvent } from "react"

import {
  useAnnotationDraftState,
  type DraftDiffAnnotation,
  type DraftTarget,
  type RenderedAnnotationMetadata,
  type SavedDiffAnnotation,
} from "@/diff-viewer/annotations"
import { DiffCommentDraft } from "@/components/diff/DiffCommentDraft"
import { DiffSavedComment } from "@/components/diff/DiffSavedComment"
import {
  syncHunkActionOverlays,
  type RenderablePreparedDiff,
} from "@/components/diff/hunk-action-overlays"
import type { HunkActionInput } from "@/git/types"
import "@/components/diff/diff-pane-theme.css"

const DIFF_EXPANSION_LINE_COUNT = 20
const FAST_INLINE_DIFF_MAX_LINE_LENGTH = 300
const LARGE_DIFF_INLINE_DIFF_MAX_LINE_LENGTH = 120

type DiffLinePointerEvent = DiffLineEventBaseProps & { event: PointerEvent }
type GetHoveredDiffLine = () => DraftTarget | undefined

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
  enableAnnotations?: boolean
  enableHunkActions: boolean
  hunkActionPendingKey: string | null
  onAcceptHunk: (input: HunkActionInput) => void
  onRejectHunk: (input: HunkActionInput) => void
}

function GutterPlusIcon() {
  return (
    <svg aria-hidden="true" className="size-4" viewBox="0 0 16 16">
      <path
        fill="currentColor"
        d="M8 3a.75.75 0 0 1 .75.75v3.5h3.5a.75.75 0 0 1 0 1.5h-3.5v3.5a.75.75 0 0 1-1.5 0v-3.5h-3.5a.75.75 0 0 1 0-1.5h3.5v-3.5A.75.75 0 0 1 8 3"
      />
    </svg>
  )
}

function DiffPaneRenderer({
  diff,
  initialDraft,
  onDraftChange,
  viewMode,
  expandAll,
  savedAnnotations,
  onSaveAnnotation,
  onDeleteAnnotation,
  enableAnnotations = true,
  enableHunkActions,
  hunkActionPendingKey,
  onAcceptHunk,
  onRejectHunk,
}: DiffPaneRendererProps) {
  const lastHoveredTargetRef = useRef<DraftTarget | null>(null)

  const {
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
  } = useAnnotationDraftState({
    diff,
    savedAnnotations,
    onSaveAnnotation,
    onDeleteAnnotation,
    initialDraft,
    onDraftChange,
  })

  const handleUtilityOpenDraft = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>, getHoveredLine: GetHoveredDiffLine) => {
      event.preventDefault()
      event.stopPropagation()

      const hoveredLine = getHoveredLine() ?? lastHoveredTargetRef.current
      if (!hoveredLine) {
        return
      }

      openDraft(hoveredLine)
    },
    [openDraft]
  )

  const options = useMemo(
    () => ({
      diffStyle: viewMode,
      diffIndicators: "bars" as const,
      enableGutterUtility: enableAnnotations,
      disableFileHeader: true,
      overflow: "wrap" as const,
      hunkSeparators: "line-info" as const,
      onPostRender: (node: HTMLElement) => {
        syncHunkActionOverlays({
          node,
          diff,
          viewMode,
          enableHunkActions,
          hunkActionPendingKey,
          onAcceptHunk,
          onRejectHunk,
        })
      },
      expandUnchanged: expandAll,
      expansionLineCount: DIFF_EXPANSION_LINE_COUNT,
      maxLineDiffLength: diff.isLargeDiff
        ? LARGE_DIFF_INLINE_DIFF_MAX_LINE_LENGTH
        : FAST_INLINE_DIFF_MAX_LINE_LENGTH,
      onLineNumberClick: (line: DiffLinePointerEvent) => {
        if (!enableAnnotations) {
          return
        }

        line.event.preventDefault()
        line.event.stopPropagation()
        openDraft({
          lineNumber: line.lineNumber,
          side: line.annotationSide,
        })
      },
      onLineEnter: (line: DiffLinePointerEvent) => {
        lastHoveredTargetRef.current = {
          lineNumber: line.lineNumber,
          side: line.annotationSide,
        }
      },
    }),
    [
      diff,
      enableAnnotations,
      enableHunkActions,
      expandAll,
      openDraft,
      hunkActionPendingKey,
      onAcceptHunk,
      onRejectHunk,
      viewMode,
    ]
  )

  return (
    <FileDiff<RenderedAnnotationMetadata>
      fileDiff={diff.parsedDiff}
      options={options}
      lineAnnotations={lineAnnotations}
      renderAnnotation={
        enableAnnotations
          ? (annotation) => {
              if (annotation.metadata?.kind === "saved") {
                return (
                  <DiffSavedComment
                    comment={annotation.metadata.comment}
                    onOpen={() => openDraft(annotation)}
                  />
                )
              }

              return (
                <DiffCommentDraft
                  focusKey={focusKey}
                  value={draftText}
                  canSave={canSaveDraft}
                  isEditingExisting={isEditingExisting}
                  onChange={changeDraft}
                  onDelete={isEditingExisting ? deleteDraft : undefined}
                  onSave={saveDraft}
                  onEscape={closeDraft}
                />
              )
            }
          : undefined
      }
      renderGutterUtility={
        enableAnnotations
          ? (getHoveredLine) => {
              return (
                <button
                  type="button"
                  className="diff-gutter-comment-button"
                  aria-label="Comment on line"
                  title="Comment on line"
                  onClick={(event) => handleUtilityOpenDraft(event, getHoveredLine)}
                >
                  <GutterPlusIcon />
                </button>
              )
            }
          : undefined
      }
      className="diff-pane-theme block h-full min-h-full min-w-0"
    />
  )
}

export default DiffPaneRenderer
