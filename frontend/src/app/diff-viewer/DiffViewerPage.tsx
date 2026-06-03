import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { FolderTree, LoaderCircle, Settings2 } from "lucide-react"

import { AISettingsModal } from "@/app/ai/components/AISettingsModal"
import { useCommitMessageSuggestion } from "@/app/ai/hooks/useCommitMessageSuggestion"
import { useAISettings } from "@/app/ai/hooks/useAISettings"
import { useDiffViewerPreferences } from "@/app/diff-viewer/useDiffViewerPreferences"
import { BranchCompareLoading } from "@/diff-viewer/BranchCompareLoading"
import { DiffViewerToolbar } from "@/diff-viewer/DiffViewerToolbar"
import { useRepoEventsRefresh } from "@/diff-viewer/useRepoEventsRefresh"
import { useAnnotationSession } from "@/diff-viewer/hooks/useAnnotationSession"
import { useBranchesState } from "@/diff-viewer/hooks/useBranchesState"
import { useChangedFilesState } from "@/diff-viewer/hooks/useChangedFilesState"
import { useCommitsState } from "@/diff-viewer/hooks/useCommitsState"
import { useFileTreeNav } from "@/diff-viewer/hooks/useFileTreeNav"
import { useGitActionCommands } from "@/diff-viewer/hooks/useGitActionCommands"
import { useMergeConflictState } from "@/diff-viewer/hooks/useMergeConflictState"
import { useSelectedDiff } from "@/diff-viewer/hooks/useSelectedDiff"
import type { ChangedFilesResult } from "@/git/types"
import { fuzzyFilterChangedFiles } from "@/components/file-tree/fuzzy-search"
import { AppShell } from "@/components/app-shell"
import { DiffFileHeader } from "@/components/diff/DiffFileHeader"
import { DiffPane } from "@/components/diff/DiffPane"
import { MergeConflictPane } from "@/components/diff/MergeConflictPane"
import { FileTreePanel } from "@/components/sidebar/FileTreePanel"
import type { SidebarPanelTab } from "@/components/sidebar/SidebarPanelTabs"
import { GitActionsPanel } from "@/components/sidebar/GitActionsPanel"
import { SiteHeader } from "@/components/site-header"
import { Button } from "@/components/ui/button"
import { SidebarHeader } from "@/components/ui/sidebar"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useScope, useShortcut } from "@/lib/shortcuts"

export function DiffViewerPage() {
  const fileWindowScrollRef = useRef<HTMLDivElement | null>(null)
  const [latestChangedFilesResult, setLatestChangedFilesResult] =
    useState<ChangedFilesResult | null>(null)
  const [isAISettingsModalOpen, setIsAISettingsModalOpen] = useState(false)
  const [fileSearchQuery, setFileSearchQuery] = useState("")
  const [sidebarTab, setSidebarTab] = useState<SidebarPanelTab>("current")

  const {
    branches,
    branchesError,
    isBranchesLoading,
    refreshBranches,
    setBranchesError,
  } = useBranchesState()

  const {
    baseCommit,
    branchSync,
    comparisonMode,
    currentRef,
    files,
    filesError,
    handleSelectBaseRef,
    hiddenStagedFileCount,
    isFilesLoading,
    mergeState,
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

  const {
    conflictFile,
    conflictFileError,
    getConflictProgressLabel,
    isConflictFileLoading,
    isConflictMode,
    isResolvePending,
    resolveSelectedConflict,
    selectedConflictPath,
    showAllFiles,
    showConflicts,
    showMergeResolvedState,
    visibleFiles,
  } = useMergeConflictState({
    files,
    mergeState,
    selectedFilePath,
    setSelectedFilePath,
    refreshChangedFiles,
  })

  const filteredVisibleFiles = useMemo(
    () => fuzzyFilterChangedFiles(visibleFiles, fileSearchQuery),
    [fileSearchQuery, visibleFiles]
  )
  const selectedFile =
    filteredVisibleFiles.find((file) => file.path === selectedFilePath) ??
    filteredVisibleFiles[0] ??
    null
  const initialDiffPreloads = useMemo(() => {
    if (!latestChangedFilesResult?.diffs) {
      return null
    }

    return latestChangedFilesResult.diffs.flatMap((diff) => {
      const file = latestChangedFilesResult.files.find(
        (candidate) =>
          candidate.path === diff.path &&
          (candidate.previousPath ?? "") === (diff.previousPath ?? "") &&
          candidate.status === diff.status
      )

      return file ? [{ file, diff }] : []
    })
  }, [latestChangedFilesResult])
  const repoLabel = repoName || workspaceName || "repository"

  const {
    tree,
    expandedPaths,
    hasExpandableFolders,
    areAllFoldersExpanded,
    handleToggleFolder,
    handleToggleAllFolders,
    prevFile,
    nextFile,
    indexOfSelected,
    totalNavigable,
  } = useFileTreeNav({
    files: filteredVisibleFiles,
    selectedFilePath: selectedFile?.path ?? null,
    repoName,
    workspaceName,
    autoExpandFolders: fileSearchQuery.trim().length > 0,
  })

  useScope("diff")

  const goPrevFile = useCallback(() => {
    if (prevFile) setSelectedFilePath(prevFile.path)
  }, [prevFile, setSelectedFilePath])

  const goNextFile = useCallback(() => {
    if (nextFile) setSelectedFilePath(nextFile.path)
  }, [nextFile, setSelectedFilePath])

  useShortcut("prevFile", goPrevFile)
  useShortcut("prevFileAlt", goPrevFile)
  useShortcut("nextFile", goNextFile)
  useShortcut("nextFileAlt", goNextFile)

  const scrollFileWindowBy = useCallback((offset: number) => {
    fileWindowScrollRef.current?.scrollBy({ top: offset, behavior: "auto" })
  }, [])

  useShortcut("scrollFileUp", () => {
    scrollFileWindowBy(-120)
  })
  useShortcut("scrollFileDown", () => {
    scrollFileWindowBy(120)
  })

  const {
    currentDisplayedDiff,
    diffError,
    isDiffLoading,
  } = useSelectedDiff({
    baseCommit,
    initialDiffs: initialDiffPreloads,
    initialDiff: latestChangedFilesResult?.initialDiff ?? null,
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
  }, [latestChangedFilesResult, pruneForFiles])

  const gitActions = useGitActionCommands({
    currentBranch: currentRef,
    files: visibleFiles,
    refreshBranches,
    refreshChangedFiles,
  })
  const {
    commits,
    commitsError,
    isCommitsLoading,
    refreshCommits,
    setCommitsError,
  } = useCommitsState({
    enabled: sidebarTab === "commits",
    currentRef,
  })
  const aiSettingsState = useAISettings()
  const diffViewerPreferencesState = useDiffViewerPreferences()
  const { preferences: diffViewerPreferences, updateActivePreferences } =
    diffViewerPreferencesState
  const commitFeatureState = aiSettingsState.featureStateByID.commitMessage
  const commitProviderStatus = commitFeatureState?.provider
    ? aiSettingsState.agentByID[commitFeatureState.provider]
    : undefined

  const commitSuggestion = useCommitMessageSuggestion({
    onApplySuggestion: (message) => {
      gitActions.setCommitMessage(message)
    },
  })

  const suggestCommitDisabledReason = useMemo(() => {
    if (comparisonMode !== "head") {
      return "Switch to HEAD to generate commit messages."
    }

    if (visibleFiles.filter((file) => file.hasStagedChanges).length === 0) {
      return "Stage at least one file to generate a commit message."
    }

    if (hiddenStagedFileCount > 0) {
      return "Unscope hidden staged files before generation."
    }

    if (aiSettingsState.isCheckingAgents) {
      return "Checking provider availability..."
    }

    if (!commitFeatureState?.provider) {
      return "Select a provider for Commit Message in settings."
    }

    if (!commitFeatureState.providerValid) {
      return commitProviderStatus?.reason ?? "Configured provider is not selectable."
    }

    return null
  }, [
    aiSettingsState.isCheckingAgents,
    commitFeatureState?.provider,
    commitFeatureState?.providerValid,
    commitProviderStatus?.reason,
    comparisonMode,
    hiddenStagedFileCount,
    visibleFiles,
  ])

  useShortcut("toggleStage", () => {
    if (selectedFile) gitActions.handleToggleStage(selectedFile)
  })
  useShortcut("discardFile", () => {
    if (comparisonMode === "head" && selectedFile) gitActions.handleDiscardFile(selectedFile)
  })
  useShortcut("copyAnnotations", () => {
    if (canCopyAnnotations) copyAnnotations()
  })
  useShortcut("sendToAgent", () => {
    if (canSendAnnotations) sendAnnotations()
  })

  const viewMode = diffViewerPreferences.viewMode
  const isCurrentFileExpanded = diffViewerPreferences.diffDetailMode === "fullFile"

  useShortcut("toggleViewMode", () => {
    void updateActivePreferences({
      viewMode: viewMode === "split" ? "unified" : "split",
    })
  })

  useEffect(() => {
    document.title = repoName ? `DiffX - ${repoName}` : "DiffX"
  }, [repoName])

  const handleLiveRefreshError = useCallback(
    (error: Error, phase: "files" | "branches" | "commits", signal: AbortSignal) => {
      if (signal.aborted) {
        return
      }

      if (phase === "files") {
        setFilesError(error.message)
        return
      }

      if (phase === "commits") {
        setCommitsError(error.message)
        return
      }

      setBranchesError(error.message)
    },
    [setBranchesError, setCommitsError, setFilesError]
  )

  const shouldRefreshCommits = useCallback(() => sidebarTab === "commits", [sidebarTab])

  useRepoEventsRefresh({
    refreshChangedFiles,
    refreshBranches,
    refreshCommits,
    shouldRefreshCommits,
    onError: handleLiveRefreshError,
  })

  const handleToggleCurrentFileExpanded = useCallback(() => {
    void updateActivePreferences({
      diffDetailMode: isCurrentFileExpanded ? "stacked" : "fullFile",
    })
  }, [isCurrentFileExpanded, updateActivePreferences])
  useShortcut("toggleExpandFile", handleToggleCurrentFileExpanded)

  const handleViewModeChange = useCallback(
    (nextViewMode: "split" | "unified") => {
      void updateActivePreferences({ viewMode: nextViewMode })
    },
    [updateActivePreferences]
  )

  const headerError =
    filesError && !isFilesLoading
      ? filesError
      : branchesError && !isBranchesLoading
        ? branchesError
        : selectedFile && diffError && !isDiffLoading
          ? diffError
          : null
  const isSelectedFileStagePending =
    selectedFile != null && gitActions.stagePendingPaths.includes(selectedFile.path)
  const isSelectedFileDiscardPending =
    selectedFile != null && gitActions.discardPendingPaths.includes(selectedFile.path)
  const isBranchCompareLoading = isFilesLoading && selectedBaseRef !== "HEAD"
  const mergeModeSummary =
    mergeState.unresolvedCount === 1
      ? "1 conflicted file remaining"
      : `${mergeState.unresolvedCount} conflicted files remaining`
  const selectedConflictProgressLabel =
    selectedFile && selectedFile.status === "conflicted"
      ? getConflictProgressLabel(selectedFile.path)
      : null

  return (
    <AppShell
      sidebarContent={
        <>
          <SidebarHeader className="relative h-(--header-height) justify-center gap-0 px-0 py-0">
            <div className="flex h-full items-center px-4">
              <div className="flex items-center gap-3">
                <div className="rounded-xl border border-sidebar-border/70 bg-[var(--surface-sidebar-accent)] p-1.5 text-sidebar-primary">
                  <FolderTree className="size-4" />
                </div>
                <div className="min-w-0">
                  <p className="truncate type-title text-sidebar-foreground">
                    {repoLabel}
                  </p>
                </div>
              </div>
            </div>
          </SidebarHeader>

          <div className="flex min-h-0 flex-1 flex-col">
            <FileTreePanel
              activeTab={sidebarTab}
              onActiveTabChange={setSidebarTab}
              files={filteredVisibleFiles}
              totalFileCount={visibleFiles.length}
              searchQuery={fileSearchQuery}
              onSearchQueryChange={setFileSearchQuery}
              tree={tree}
              expandedPaths={expandedPaths}
              hasExpandableFolders={hasExpandableFolders}
              areAllFoldersExpanded={areAllFoldersExpanded}
              onToggleFolder={handleToggleFolder}
              onToggleAllFolders={handleToggleAllFolders}
              selectedFile={selectedFile}
              scopePath={scopePath}
              comparisonMode={comparisonMode}
              isMergeInProgress={mergeState.inProgress}
              onSelectFile={setSelectedFilePath}
              stagePendingPaths={gitActions.stagePendingPaths}
              isBulkStagePending={gitActions.isBulkStagePending}
              onToggleStage={gitActions.handleToggleStage}
              onStageAll={gitActions.handleStageAll}
              onUnstageAll={gitActions.handleUnstageAll}
              currentRef={currentRef}
              commits={commits}
              isCommitsLoading={isCommitsLoading}
              commitsError={commitsError}
            />

            <GitActionsPanel
              branchName={currentRef}
              branches={branches}
              isBranchesLoading={isBranchesLoading}
              comparisonMode={comparisonMode}
              files={visibleFiles}
              hasUpstream={branchSync.hasUpstream}
              aheadCount={branchSync.aheadCount}
              hiddenStagedFileCount={hiddenStagedFileCount}
              commitMessage={gitActions.commitMessage}
              isCommitPending={gitActions.isCommitPending}
              onCommitMessageChange={gitActions.setCommitMessage}
              isSuggestCommitPending={commitSuggestion.isPending}
              onSuggestCommitMessage={commitSuggestion.suggest}
              isCommitMessageProviderValid={commitFeatureState?.providerValid ?? false}
              isCheckingAIProviders={aiSettingsState.isCheckingAgents}
              suggestCommitDisabledReason={suggestCommitDisabledReason}
              onCommit={gitActions.handleCommit}
              isPushPending={gitActions.isPushPending}
              onPush={gitActions.handlePush}
              isFetchPending={gitActions.isFetchPending}
              onFetch={gitActions.handleFetch}
              isPullPending={gitActions.isPullPending}
              onPull={gitActions.handlePull}
              isCheckoutPending={gitActions.isCheckoutPending}
              onCheckoutBranch={gitActions.handleCheckoutBranch}
            />
          </div>
        </>
      }
      header={
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
          settingsControl={
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="outline"
                    aria-label="Settings"
                    onClick={() => setIsAISettingsModalOpen(true)}
                  >
                    {aiSettingsState.isCheckingAgents || diffViewerPreferencesState.isLoading ? (
                      <LoaderCircle className="animate-spin" />
                    ) : (
                      <Settings2 />
                    )}
                    <span className="sr-only">Settings</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={6}>
                  Settings
                </TooltipContent>
              </Tooltip>
              <AISettingsModal
                open={isAISettingsModalOpen}
                onOpenChange={setIsAISettingsModalOpen}
                settingsState={aiSettingsState}
                diffViewerPreferencesState={diffViewerPreferencesState}
              />
            </>
          }
        />
      }
    >
      <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {headerError ? (
          <div className="border-b border-border/60 px-4 py-2">
            <p className="measure-readable type-meta text-destructive">{headerError}</p>
          </div>
        ) : null}
        {mergeState.inProgress ? (
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
                  onClick={showConflicts}
                >
                  Conflicts
                </Button>
                <Button
                  type="button"
                  size="xs"
                  variant={!isConflictMode ? "secondary" : "ghost"}
                  aria-pressed={!isConflictMode}
                  onClick={showAllFiles}
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
              <Button type="button" size="sm" variant="outline" onClick={showAllFiles}>
                View All Files
              </Button>
            </div>
          </div>
        ) : null}

        <div ref={fileWindowScrollRef} className="min-h-0 min-w-0 flex-1 overflow-auto px-[2px]">
          {isBranchCompareLoading ? (
            <BranchCompareLoading baseRef={selectedBaseRef} />
          ) : (
            <>
              {selectedFile ? (
                <div className="sticky top-0 z-20">
                  <div className="relative z-20">
                    <DiffViewerToolbar
                      diff={currentDisplayedDiff}
                      comparisonMode={comparisonMode}
                      selectedFile={selectedFile}
                      isStagePending={isSelectedFileStagePending}
                      isDiscardPending={isSelectedFileDiscardPending}
                      viewMode={viewMode}
                      isExpanded={isCurrentFileExpanded}
                      canGoPrev={prevFile != null}
                      canGoNext={nextFile != null}
                      fileIndex={indexOfSelected}
                      totalFiles={totalNavigable}
                      onToggleExpandAll={handleToggleCurrentFileExpanded}
                      onToggleStage={gitActions.handleToggleStage}
                      onDiscardFile={gitActions.handleDiscardFile}
                      onViewModeChange={handleViewModeChange}
                      onGoPrev={goPrevFile}
                      onGoNext={goNextFile}
                    />
                  </div>
                  <div className="relative z-10">
                    <DiffFileHeader
                      file={selectedFile}
                      diff={currentDisplayedDiff}
                      isDiffLoading={isDiffLoading}
                      scopePath={scopePath}
                      conflictProgressLabel={selectedConflictProgressLabel}
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
                  currentDiff={selectedFile ? currentDisplayedDiff : null}
                  clearDraftToken={clearDraftToken}
                  savedAnnotations={visibleSavedAnnotations}
                  onSaveAnnotation={saveAnnotation}
                  onDeleteAnnotation={deleteAnnotation}
                  onResolveConflict={resolveSelectedConflict}
                />
              ) : (
                <DiffPane
                  diff={selectedFile ? currentDisplayedDiff : null}
                  hasSelectedFile={!!selectedFile}
                  viewMode={viewMode}
                  expandAll={isCurrentFileExpanded}
                  savedAnnotations={visibleSavedAnnotations}
                  clearDraftToken={clearDraftToken}
                  onSaveAnnotation={saveAnnotation}
                  onDeleteAnnotation={deleteAnnotation}
                  enableHunkActions={
                    comparisonMode === "head" &&
                    !mergeState.inProgress &&
                    selectedFile?.hasUnstagedChanges === true
                  }
                  hunkActionPendingKey={gitActions.hunkActionPendingKey}
                  onAcceptHunk={gitActions.handleAcceptHunk}
                  onRejectHunk={gitActions.handleRejectHunk}
                />
              )}
            </>
          )}
        </div>
      </section>
    </AppShell>
  )
}
