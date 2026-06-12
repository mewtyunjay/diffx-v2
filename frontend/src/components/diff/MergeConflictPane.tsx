import {
  UnresolvedFile,
  type DiffLineEventBaseProps,
  type MergeConflictResolution,
} from "@pierre/diffs/react"

import {
  useAnnotationDraftState,
  type RenderedAnnotationMetadata,
  type SavedDiffAnnotation,
} from "@/diff-viewer/annotations"
import { DiffCommentDraft } from "@/components/diff/DiffCommentDraft"
import { DiffPlaceholder } from "@/components/diff/DiffPlaceholder"
import { DiffSavedComment } from "@/components/diff/DiffSavedComment"
import { resolveMergeConflictContents } from "@/components/diff/merge-conflict-resolution"
import type { PreparedFileDiffResult } from "@/diffs/create"
import type { ConflictFileResult } from "@/git/types"
import "@/components/diff/diff-pane-theme.css"

type DiffLinePointerEvent = DiffLineEventBaseProps & { event: PointerEvent }

type MergeConflictPaneProps = {
  selectedFilePath: string | null
  conflictFile: ConflictFileResult | null
  conflictFileError: string | null
  isConflictFileLoading: boolean
  isResolvePending: boolean
  currentDiff: PreparedFileDiffResult | null
  clearDraftToken: number
  savedAnnotations: SavedDiffAnnotation[]
  onSaveAnnotation: (
    target: Pick<SavedDiffAnnotation, "side" | "lineNumber">,
    comment: string
  ) => void
  onDeleteAnnotation: (target: Pick<SavedDiffAnnotation, "side" | "lineNumber">) => void
  onResolveConflict: (contents: string) => Promise<void>
}

function hasMergeConflictMarkers(contents: string) {
  return contents.includes("<<<<<<<") && contents.includes("=======") && contents.includes(">>>>>>>")
}

function MergeConflictResolver({
  file,
  currentDiff,
  clearDraftToken,
  savedAnnotations,
  isResolvePending,
  onSaveAnnotation,
  onDeleteAnnotation,
  onResolveConflict,
}: {
  file: ConflictFileResult
  currentDiff: PreparedFileDiffResult | null
  clearDraftToken: number
  savedAnnotations: SavedDiffAnnotation[]
  isResolvePending: boolean
  onSaveAnnotation: (
    target: Pick<SavedDiffAnnotation, "side" | "lineNumber">,
    comment: string
  ) => void
  onDeleteAnnotation: (target: Pick<SavedDiffAnnotation, "side" | "lineNumber">) => void
  onResolveConflict: (contents: string) => Promise<void>
}) {
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
    diff: currentDiff,
    savedAnnotations,
    onSaveAnnotation,
    onDeleteAnnotation,
  })

  return (
    <UnresolvedFile<RenderedAnnotationMetadata>
      key={`${clearDraftToken}:merge:${file.path}:${file.contentKey}`}
      file={{
        name: file.path,
        contents: file.contents,
        cacheKey: file.contentKey,
      }}
      options={{
        onLineNumberClick: (line: DiffLinePointerEvent) => {
          line.event.preventDefault()
          line.event.stopPropagation()
          openDraft({
            lineNumber: line.lineNumber,
            side: line.annotationSide,
          })
        },
      }}
      renderMergeConflictUtility={(action) => {
        const handleResolve = (resolution: MergeConflictResolution) => {
          if (isResolvePending) {
            return
          }

          const contents = resolveMergeConflictContents(file.contents, action.conflict, resolution)
          closeDraft()
          void onResolveConflict(contents)
        }

        return (
          <div className="diff-merge-conflict-actions">
            <button
              type="button"
              className="diff-hunk-overlay-button diff-hunk-overlay-button-reject"
              disabled={isResolvePending}
              aria-label="Use current conflict changes"
              onClick={() => handleResolve("current")}
            >
              Current
            </button>
            <button
              type="button"
              className="diff-hunk-overlay-button diff-hunk-overlay-button-accept"
              disabled={isResolvePending}
              aria-label="Use incoming recommended conflict changes"
              onClick={() => handleResolve("incoming")}
            >
              Incoming (Rec)
            </button>
            <button
              type="button"
              className="diff-hunk-overlay-button diff-hunk-overlay-button-reject"
              disabled={isResolvePending}
              aria-label="Use both conflict changes"
              onClick={() => handleResolve("both")}
            >
              Both
            </button>
          </div>
        )
      }}
      lineAnnotations={lineAnnotations}
      renderAnnotation={(annotation) => {
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
      }}
      className="diff-pane-theme block h-full min-h-full min-w-0"
    />
  )
}

export function MergeConflictPane({
  selectedFilePath,
  conflictFile,
  conflictFileError,
  isConflictFileLoading,
  isResolvePending,
  currentDiff,
  clearDraftToken,
  savedAnnotations,
  onSaveAnnotation,
  onDeleteAnnotation,
  onResolveConflict,
}: MergeConflictPaneProps) {
  if (!selectedFilePath) {
    return <DiffPlaceholder>Select a conflicted file to resolve.</DiffPlaceholder>
  }

  if (isConflictFileLoading && !conflictFile) {
    return <div className="h-full min-h-0" />
  }

  if (conflictFileError) {
    return <DiffPlaceholder>{conflictFileError}</DiffPlaceholder>
  }

  if (!conflictFile || !conflictFile.exists) {
    return (
      <DiffPlaceholder>
        This unmerged entry has no working tree file. Resolve it manually in your editor/terminal, then stage
        it.
      </DiffPlaceholder>
    )
  }

  if (conflictFile.binary) {
    return (
      <DiffPlaceholder>
        This conflict involves binary content. Resolve it manually in your editor/terminal, then stage it.
      </DiffPlaceholder>
    )
  }

  if (conflictFile.tooLarge) {
    return (
      <DiffPlaceholder>
        This conflict file is too large for inline resolution. Resolve it manually in your editor/terminal, then
        stage it.
      </DiffPlaceholder>
    )
  }

  if (!hasMergeConflictMarkers(conflictFile.contents)) {
    return (
      <DiffPlaceholder>
        This unmerged file does not contain merge markers. Resolve it manually (edit/delete/restore), then stage
        it.
      </DiffPlaceholder>
    )
  }

  return (
    <MergeConflictResolver
      file={conflictFile}
      currentDiff={currentDiff}
      clearDraftToken={clearDraftToken}
      savedAnnotations={savedAnnotations}
      isResolvePending={isResolvePending}
      onSaveAnnotation={onSaveAnnotation}
      onDeleteAnnotation={onDeleteAnnotation}
      onResolveConflict={onResolveConflict}
    />
  )
}
