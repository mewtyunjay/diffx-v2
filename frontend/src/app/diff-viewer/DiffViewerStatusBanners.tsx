import { Button } from "@/components/ui/button"

type DiffViewerStatusBannersProps = {
  headerError: string | null
  isMergeInProgress: boolean
  isConflictMode: boolean
  mergeModeSummary: string
  showMergeResolvedState: boolean
  onShowConflicts: () => void
  onShowAllFiles: () => void
}

export function DiffViewerStatusBanners({
  headerError,
  isMergeInProgress,
  isConflictMode,
  mergeModeSummary,
  showMergeResolvedState,
  onShowConflicts,
  onShowAllFiles,
}: DiffViewerStatusBannersProps) {
  return (
    <>
      {headerError ? (
        <div className="border-b border-border/60 px-4 py-2">
          <p className="measure-readable type-meta text-destructive">{headerError}</p>
        </div>
      ) : null}
      {isMergeInProgress ? (
        <div className="border-b border-border/60 px-4 py-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="measure-readable type-meta text-muted-foreground">
              {isConflictMode ? mergeModeSummary : "Viewing all changed files during merge."}
            </p>
            <div
              className="surface-segmented flex items-center gap-0.5 p-0.5"
              role="group"
              aria-label="Merge view mode"
            >
              <Button
                type="button"
                size="xs"
                variant={isConflictMode ? "secondary" : "ghost"}
                aria-pressed={isConflictMode}
                onClick={onShowConflicts}
              >
                Conflicts
              </Button>
              <Button
                type="button"
                size="xs"
                variant={!isConflictMode ? "secondary" : "ghost"}
                aria-pressed={!isConflictMode}
                onClick={onShowAllFiles}
              >
                All Files
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      {showMergeResolvedState ? (
        <div className="border-b border-border/60 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="measure-readable type-meta text-muted-foreground">
              All merge conflicts are resolved. Stage and commit to finish the merge.
            </p>
            <Button type="button" size="sm" variant="outline" onClick={onShowAllFiles}>
              View All Files
            </Button>
          </div>
        </div>
      ) : null}
    </>
  )
}
