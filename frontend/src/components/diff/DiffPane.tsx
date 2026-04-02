import type { SavedDiffAnnotation } from "@/app/diff-viewer/annotations"
import type { PreparedFileDiffResult } from "@/components/diff/prepareDiff"
import DiffPaneRenderer from "@/components/diff/DiffPaneRenderer"

type DiffPaneProps = {
  diff: PreparedFileDiffResult | null
  hasSelectedFile: boolean
  viewMode: "split" | "unified"
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
  savedAnnotations,
  clearDraftToken,
  onSaveAnnotation,
  onDeleteAnnotation,
}: DiffPaneProps) {
  if (!diff) {
    if (hasSelectedFile) {
      return <div className="h-full min-h-0" />
    }

    return (
      <div className="flex h-full min-h-0 items-center justify-center rounded-lg border border-dashed border-border/60 bg-background/40 px-6 text-center text-sm text-muted-foreground">
        Select a file to view its diff.
      </div>
    )
  }

  if (diff.binary) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center rounded-lg border border-dashed border-border/60 bg-background/40 px-6 text-center text-sm text-muted-foreground">
        Binary files are not rendered in the inline diff viewer yet.
      </div>
    )
  }

  if (diff.tooLarge) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center rounded-lg border border-dashed border-border/60 bg-background/40 px-6 text-center text-sm text-muted-foreground">
        This file is too large for the fast inline diff path right now.
      </div>
    )
  }

  if (diff.isPureRename) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center rounded-lg border border-dashed border-border/60 bg-background/40 px-6 text-center text-sm text-muted-foreground">
        File renamed without textual changes.
      </div>
    )
  }

  if (!diff.parsedDiff) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center rounded-lg border border-dashed border-border/60 bg-background/40 px-6 text-center text-sm text-muted-foreground">
        No text diff is available for this file.
      </div>
    )
  }

  const renderableDiff = diff as RenderablePreparedDiff

  return (
    <DiffPaneRenderer
      key={`${viewMode}:${clearDraftToken}:${renderableDiff.path}:${renderableDiff.before.cacheKey}:${renderableDiff.after.cacheKey}`}
      diff={renderableDiff}
      viewMode={viewMode}
      savedAnnotations={savedAnnotations}
      onSaveAnnotation={onSaveAnnotation}
      onDeleteAnnotation={onDeleteAnnotation}
    />
  )
}
