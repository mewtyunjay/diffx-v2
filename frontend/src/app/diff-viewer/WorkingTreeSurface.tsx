import { BranchCompareLoading } from "@/diff-viewer/BranchCompareLoading"
import { DiffViewerToolbar } from "@/diff-viewer/DiffViewerToolbar"
import { DiffFileHeader } from "@/components/diff/DiffFileHeader"
import { DiffPane } from "@/components/diff/DiffPane"
import { MergeConflictPane } from "@/components/diff/MergeConflictPane"
import type { PreparedFileDiffResult } from "@/diffs/create"
import type { SavedDiffAnnotation } from "@/diff-viewer/annotations"
import type {
  ChangedFileItem,
  ComparisonMode,
  ConflictFileResult,
  HunkActionInput,
} from "@/git/types"

type DiffViewMode = "split" | "unified"

type WorkingTreeSurfaceProps = {
  isBranchCompareLoading: boolean
  selectedBaseRef: string
  selectedFile: ChangedFileItem | null
  currentDiff: PreparedFileDiffResult | null
  comparisonMode: ComparisonMode
  isMergeInProgress: boolean
  scopePath: string
  canPreview: boolean
  renderMode: "code" | "preview"
  viewMode: DiffViewMode
  isExpanded: boolean
  isDiffLoading: boolean
  conflictProgressLabel: string | null
  isStagePending: boolean
  isDiscardPending: boolean
  canGoPrev: boolean
  canGoNext: boolean
  fileIndex: number
  totalFiles: number
  onToggleExpandAll: () => void
  onToggleStage: (file: ChangedFileItem) => void
  onDiscardFile: (file: ChangedFileItem) => void
  onToggleRenderMode: () => void
  onViewModeChange: (viewMode: DiffViewMode) => void
  onGoPrev: () => void
  onGoNext: () => void
  isConflictMode: boolean
  selectedConflictPath: string | null
  conflictFile: ConflictFileResult | null
  conflictFileError: string | null
  isConflictFileLoading: boolean
  isResolvePending: boolean
  onResolveConflict: (contents: string) => Promise<void>
  clearDraftToken: number
  savedAnnotations: SavedDiffAnnotation[]
  onSaveAnnotation: (
    target: Pick<SavedDiffAnnotation, "side" | "lineNumber">,
    comment: string
  ) => void
  onDeleteAnnotation: (target: Pick<SavedDiffAnnotation, "side" | "lineNumber">) => void
  hunkActionPendingKey: string | null
  onAcceptHunk: (input: HunkActionInput) => void
  onRejectHunk: (input: HunkActionInput) => void
}

export function WorkingTreeSurface({
  isBranchCompareLoading,
  selectedBaseRef,
  selectedFile,
  currentDiff,
  comparisonMode,
  isMergeInProgress,
  scopePath,
  canPreview,
  renderMode,
  viewMode,
  isExpanded,
  isDiffLoading,
  conflictProgressLabel,
  isStagePending,
  isDiscardPending,
  canGoPrev,
  canGoNext,
  fileIndex,
  totalFiles,
  onToggleExpandAll,
  onToggleStage,
  onDiscardFile,
  onToggleRenderMode,
  onViewModeChange,
  onGoPrev,
  onGoNext,
  isConflictMode,
  selectedConflictPath,
  conflictFile,
  conflictFileError,
  isConflictFileLoading,
  isResolvePending,
  onResolveConflict,
  clearDraftToken,
  savedAnnotations,
  onSaveAnnotation,
  onDeleteAnnotation,
  hunkActionPendingKey,
  onAcceptHunk,
  onRejectHunk,
}: WorkingTreeSurfaceProps) {
  if (isBranchCompareLoading) {
    return <BranchCompareLoading baseRef={selectedBaseRef} />
  }

  return (
    <>
      {selectedFile ? (
        <div className="sticky top-0 z-20">
          <div className="relative z-20">
            <DiffViewerToolbar
              diff={currentDiff}
              comparisonMode={comparisonMode}
              selectedFile={selectedFile}
              isStagePending={isStagePending}
              isDiscardPending={isDiscardPending}
              canPreview={canPreview}
              renderMode={renderMode}
              viewMode={viewMode}
              isExpanded={isExpanded}
              canGoPrev={canGoPrev}
              canGoNext={canGoNext}
              fileIndex={fileIndex}
              totalFiles={totalFiles}
              onToggleExpandAll={onToggleExpandAll}
              onToggleStage={onToggleStage}
              onDiscardFile={onDiscardFile}
              onToggleRenderMode={onToggleRenderMode}
              onViewModeChange={onViewModeChange}
              onGoPrev={onGoPrev}
              onGoNext={onGoNext}
            />
          </div>
          <div className="relative z-10">
            <DiffFileHeader
              file={selectedFile}
              diff={currentDiff}
              isDiffLoading={isDiffLoading}
              scopePath={scopePath}
              conflictProgressLabel={conflictProgressLabel}
            />
          </div>
        </div>
      ) : null}

      {isConflictMode ? (
        <MergeConflictPane
          selectedFilePath={selectedConflictPath}
          conflictFile={conflictFile}
          conflictFileError={conflictFileError}
          isConflictFileLoading={isConflictFileLoading}
          isResolvePending={isResolvePending}
          currentDiff={selectedFile ? currentDiff : null}
          clearDraftToken={clearDraftToken}
          savedAnnotations={savedAnnotations}
          onSaveAnnotation={onSaveAnnotation}
          onDeleteAnnotation={onDeleteAnnotation}
          onResolveConflict={onResolveConflict}
        />
      ) : (
        <DiffPane
          diff={selectedFile ? currentDiff : null}
          hasSelectedFile={!!selectedFile}
          renderMode={renderMode}
          viewMode={viewMode}
          expandAll={isExpanded}
          savedAnnotations={savedAnnotations}
          clearDraftToken={clearDraftToken}
          onSaveAnnotation={onSaveAnnotation}
          onDeleteAnnotation={onDeleteAnnotation}
          enableHunkActions={
            comparisonMode === "head" &&
            !isMergeInProgress &&
            selectedFile?.hasUnstagedChanges === true
          }
          hunkActionPendingKey={hunkActionPendingKey}
          onAcceptHunk={onAcceptHunk}
          onRejectHunk={onRejectHunk}
        />
      )}
    </>
  )
}
