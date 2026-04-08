import { useCallback, useEffect, useState, type CSSProperties } from "react"

import { DiffViewerToolbar } from "@/diff-viewer/DiffViewerToolbar"
import { useRepoEventsRefresh } from "@/diff-viewer/useRepoEventsRefresh"
import { useAnnotationSession } from "@/diff-viewer/hooks/useAnnotationSession"
import { useBranchesState } from "@/diff-viewer/hooks/useBranchesState"
import { useChangedFilesState } from "@/diff-viewer/hooks/useChangedFilesState"
import { useGitActionCommands } from "@/diff-viewer/hooks/useGitActionCommands"
import { useSelectedDiff } from "@/diff-viewer/hooks/useSelectedDiff"
import type { ChangedFilesResult } from "@/git/types"
import { AppSidebar } from "@/components/app-sidebar"
import { DiffPane } from "@/components/diff/DiffPane"
import { SiteHeader } from "@/components/site-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"

export function DiffViewerPage() {
  const [latestChangedFilesResult, setLatestChangedFilesResult] =
    useState<ChangedFilesResult | null>(null)

  const {
    branches,
    branchesError,
    isBranchesLoading,
    refreshBranches,
    setBranchesError,
  } = useBranchesState()

  const {
    baseCommit,
    comparisonMode,
    currentRef,
    files,
    filesError,
    handleSelectBaseRef,
    hiddenStagedFileCount,
    isFilesLoading,
    refreshChangedFiles,
    repoName,
    scopePath,
    selectedBaseRef,
    selectedFilePath,
    setFilesError,
    setSelectedFilePath,
    workspaceName,
  } = useChangedFilesState({
    onApplyResult: setLatestChangedFilesResult,
  })

  const selectedFile =
    files.find((file) => file.path === selectedFilePath) ?? files[0] ?? null

  const {
    currentDisplayedDiff,
    diffError,
    isDiffLoading,
    primePreparedDiff,
  } = useSelectedDiff({
    baseCommit,
    selectedBaseRef,
    selectedFile,
  })

  const {
    canCopyAnnotations,
    canSendAnnotations,
    clearDraftToken,
    copyAnnotations,
    copyState,
    deleteAnnotation,
    pruneForDiff,
    pruneForFiles,
    saveAnnotation,
    sendAnnotations,
    sendState,
    visibleSavedAnnotations,
  } = useAnnotationSession({
    currentDiff: currentDisplayedDiff,
    selectedFile,
  })

  useEffect(() => {
    if (!currentDisplayedDiff) {
      return
    }

    pruneForDiff(currentDisplayedDiff)
  }, [currentDisplayedDiff, pruneForDiff])

  useEffect(() => {
    if (!latestChangedFilesResult) {
      return
    }

    pruneForFiles(latestChangedFilesResult.files)

    const initialDiff = latestChangedFilesResult.initialDiff
    if (!initialDiff) {
      return
    }

    const initialDiffFile =
      latestChangedFilesResult.files.find((file) => file.path === initialDiff.path) ?? null
    if (!initialDiffFile) {
      return
    }

    void primePreparedDiff(latestChangedFilesResult.baseCommit, initialDiffFile, initialDiff).catch(
      () => undefined
    )
  }, [latestChangedFilesResult, primePreparedDiff, pruneForFiles])

  const gitActions = useGitActionCommands({
    files,
    refreshBranches,
    refreshChangedFiles,
  })

  const [viewMode, setViewMode] = useState<"unified" | "split">("split")
  const [expandedDiffKey, setExpandedDiffKey] = useState<string | null>(null)
  const selectedDiffKey = selectedFile
    ? `${baseCommit}:${selectedFile.path}:${selectedFile.contentKey}`
    : null
  const isCurrentFileExpanded = selectedDiffKey != null && expandedDiffKey === selectedDiffKey

  useEffect(() => {
    document.title = repoName ? `DiffX - ${repoName}` : "DiffX"
  }, [repoName])

  const handleLiveRefreshError = useCallback(
    (error: Error, phase: "files" | "branches", signal: AbortSignal) => {
      if (signal.aborted) {
        return
      }

      if (phase === "files") {
        setFilesError(error.message)
        return
      }

      setBranchesError(error.message)
    },
    [setBranchesError, setFilesError]
  )

  useRepoEventsRefresh({
    refreshChangedFiles,
    refreshBranches,
    onError: handleLiveRefreshError,
  })

  const handleToggleCurrentFileExpanded = useCallback(() => {
    if (!selectedDiffKey) {
      return
    }

    setExpandedDiffKey((current) => (current === selectedDiffKey ? null : selectedDiffKey))
  }, [selectedDiffKey])

  const headerError =
    filesError && !isFilesLoading
      ? filesError
      : branchesError && !isBranchesLoading
        ? branchesError
        : selectedFile && diffError && !isDiffLoading
          ? diffError
          : null

  return (
    <SidebarProvider
      className="bg-sidebar"
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as CSSProperties
      }
    >
      <AppSidebar
        files={files}
        repoName={repoName}
        workspaceName={workspaceName}
        scopePath={scopePath}
        comparisonMode={comparisonMode}
        selectedFilePath={selectedFilePath}
        onSelectFile={setSelectedFilePath}
        hiddenStagedFileCount={hiddenStagedFileCount}
        stagePendingPaths={gitActions.stagePendingPaths}
        onToggleStage={gitActions.handleToggleStage}
        onStageAll={gitActions.handleStageAll}
        onUnstageAll={gitActions.handleUnstageAll}
        commitMessage={gitActions.commitMessage}
        isCommitPending={gitActions.isCommitPending}
        onCommitMessageChange={gitActions.setCommitMessage}
        onCommit={gitActions.handleCommit}
        isPushPending={gitActions.isPushPending}
        showPushAction={gitActions.showPushAction}
        onPush={gitActions.handlePush}
        variant="inset"
      />
      <SidebarInset>
        <SiteHeader
          branches={branches}
          currentRef={currentRef}
          selectedBaseRef={selectedBaseRef}
          isBranchesLoading={isBranchesLoading}
          branchesError={branchesError}
          copyState={copyState}
          sendState={sendState}
          canCopyAnnotations={canCopyAnnotations}
          canSendAnnotations={canSendAnnotations}
          onSelectBaseRef={handleSelectBaseRef}
          onCopyAnnotations={copyAnnotations}
          onSendAnnotations={sendAnnotations}
        />
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            {headerError ? (
              <div className="border-b border-border/60 px-4 py-2">
                <p className="measure-readable type-meta text-destructive">{headerError}</p>
              </div>
            ) : null}

            <div className="min-h-0 min-w-0 flex-1 overflow-auto px-[2px]">
              {selectedFile ? (
                <DiffViewerToolbar
                  path={selectedFile.path}
                  diff={currentDisplayedDiff}
                  viewMode={viewMode}
                  isExpanded={isCurrentFileExpanded}
                  onToggleExpandAll={handleToggleCurrentFileExpanded}
                  onViewModeChange={setViewMode}
                />
              ) : null}

              <DiffPane
                diff={selectedFile ? currentDisplayedDiff : null}
                hasSelectedFile={!!selectedFile}
                viewMode={viewMode}
                expandAll={isCurrentFileExpanded}
                savedAnnotations={visibleSavedAnnotations}
                clearDraftToken={clearDraftToken}
                onSaveAnnotation={saveAnnotation}
                onDeleteAnnotation={deleteAnnotation}
              />
            </div>
          </section>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
