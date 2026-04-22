import {
  UnresolvedFile,
  type AnnotationSide,
  type DiffLineAnnotation,
  type DiffLineEventBaseProps,
  type MergeConflictResolution,
} from "@pierre/diffs/react"
import { useCallback, useMemo, useState } from "react"

import {
  createAnnotationTargetKey,
  createDraftDiffAnnotation,
  type DraftDiffAnnotation,
  type SavedDiffAnnotation,
} from "@/diff-viewer/annotations"
import { DiffCommentDraft } from "@/components/diff/DiffCommentDraft"
import { DiffPlaceholder } from "@/components/diff/DiffPlaceholder"
import { DiffSavedComment } from "@/components/diff/DiffSavedComment"
import { Button } from "@/components/ui/button"
import type { PreparedFileDiffResult } from "@/diffs/create"
import type { ConflictFileResult } from "@/git/types"
import "@/components/diff/diff-pane-theme.css"

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

function isSameDraftTarget(a: DraftTarget | null, b: DraftTarget | null) {
  if (a == null || b == null) {
    return false
  }

  return a.lineNumber === b.lineNumber && a.side === b.side
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
  const [draft, setDraft] = useState<DraftDiffAnnotation | null>(() => null)

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
  const savedAnnotationMap = useMemo(
    () =>
      new Map(savedAnnotations.map((annotation) => [createAnnotationTargetKey(annotation), annotation])),
    [savedAnnotations]
  )

  const handleOpenDraft = useCallback(
    (target: DraftTarget) => {
      if (isSameDraftTarget(draftTarget, target)) {
        setDraft(null)
        return
      }

      if (!currentDiff) {
        return
      }

      const existingAnnotation = savedAnnotationMap.get(createAnnotationTargetKey(target))
      setDraft(createDraftDiffAnnotation(currentDiff, target, existingAnnotation?.comment ?? ""))
    },
    [currentDiff, draftTarget, savedAnnotationMap]
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

      return annotations
    },
    [draftTarget, savedAnnotations]
  )

  const canSaveDraft = useMemo(() => {
    const trimmed = draftText.trim()
    return (
      trimmed.length > 0 ||
      (draftTarget != null && savedAnnotationMap.has(createAnnotationTargetKey(draftTarget)))
    )
  }, [draftTarget, draftText, savedAnnotationMap])

  const handleCloseDraft = () => {
    setDraft(null)
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
    <UnresolvedFile<RenderedAnnotationMetadata>
      key={`${clearDraftToken}:merge:${file.path}`}
      file={{
        name: file.path,
        contents: file.contents,
        cacheKey: file.contentKey,
      }}
      options={{
        onLineNumberClick: (line: DiffLinePointerEvent) => {
          line.event.preventDefault()
          line.event.stopPropagation()
          handleOpenDraft({
            lineNumber: line.lineNumber,
            side: line.annotationSide,
          })
        },
      }}
      renderMergeConflictUtility={(action, getInstance) => {
        const handleResolve = (resolution: MergeConflictResolution) => {
          const instance = getInstance()
          if (!instance) {
            return
          }

          const result = instance.resolveConflict(action.conflictIndex, resolution)
          if (!result) {
            return
          }

          setDraft(null)
          void onResolveConflict(result.file.contents)
        }

        return (
          <div className="flex items-center gap-1.5 rounded-md border border-border/70 bg-background/90 p-1 shadow-sm">
            <Button
              type="button"
              size="xs"
              variant="outline"
              disabled={isResolvePending}
              onClick={() => handleResolve("current")}
            >
              Current
            </Button>
            <Button
              type="button"
              size="xs"
              disabled={isResolvePending}
              onClick={() => handleResolve("incoming")}
            >
              Incoming (Rec)
            </Button>
            <Button
              type="button"
              size="xs"
              variant="outline"
              disabled={isResolvePending}
              onClick={() => handleResolve("both")}
            >
              Both
            </Button>
          </div>
        )
      }}
      lineAnnotations={lineAnnotations}
      renderAnnotation={(annotation) => {
        if (annotation.metadata?.kind === "saved") {
          return (
            <DiffSavedComment
              comment={annotation.metadata.comment}
              onOpen={() => handleOpenDraft(annotation)}
            />
          )
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
              if (!draftTarget || !currentDiff) {
                return
              }

              setDraft(createDraftDiffAnnotation(currentDiff, draftTarget, value))
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
