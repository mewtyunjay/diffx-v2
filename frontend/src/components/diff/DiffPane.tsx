import type { SavedDiffAnnotation } from "@/app/diff-viewer/annotations"
import { DiffPlaceholder } from "@/components/diff/DiffPlaceholder"
import DiffPaneRenderer from "@/components/diff/DiffPaneRenderer"
import type { PreparedFileDiffResult } from "@/components/diff/prepareDiff"

type DiffPaneProps = {
  diff: PreparedFileDiffResult | null
  hasSelectedFile: boolean
  viewMode: "split" | "unified"
  expandAll: boolean
  savedAnnotations: SavedDiffAnnotation[]
  clearDraftToken: number
  onSaveAnnotation: (
    target: Pick<SavedDiffAnnotation, "side" | "lineNumber">,
    comment: string
  ) => void
  onDeleteAnnotation: (target: Pick<SavedDiffAnnotation, "side" | "lineNumber">) => void
}

type RenderablePreparedDiff = PreparedFileDiffResult & {
  parsedDiff: NonNullable<PreparedFileDiffResult["parsedDiff"]>
}

export function DiffPane({
  diff,
  hasSelectedFile,
  viewMode,
  expandAll,
  savedAnnotations,
  clearDraftToken,
  onSaveAnnotation,
  onDeleteAnnotation,
}: DiffPaneProps) {
  if (!diff) {
    if (hasSelectedFile) {
      return <div className="h-full min-h-0" />
    }

    return <DiffPlaceholder>Select a file to view its diff.</DiffPlaceholder>
  }

  if (diff.binary) {
    return <DiffPlaceholder>Binary files are not rendered in the inline diff viewer yet.</DiffPlaceholder>
  }

  if (diff.tooLarge) {
    return <DiffPlaceholder>This file is too large for the fast inline diff path right now.</DiffPlaceholder>
  }

  if (diff.isPureRename) {
    return <DiffPlaceholder>File renamed without textual changes.</DiffPlaceholder>
  }

  if (!diff.parsedDiff) {
    return <DiffPlaceholder>No text diff is available for this file.</DiffPlaceholder>
  }

  const renderableDiff = diff as RenderablePreparedDiff

  return (
    <DiffPaneRenderer
      key={`${viewMode}:${clearDraftToken}:${renderableDiff.path}:${renderableDiff.before.cacheKey}:${renderableDiff.after.cacheKey}`}
      diff={renderableDiff}
      viewMode={viewMode}
      expandAll={expandAll}
      savedAnnotations={savedAnnotations}
      onSaveAnnotation={onSaveAnnotation}
      onDeleteAnnotation={onDeleteAnnotation}
    />
  )
}
