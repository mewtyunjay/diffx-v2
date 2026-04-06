import {
  createSavedAnnotation,
  findPatchMetadataForAnnotation,
  formatSavedAnnotationsForCopy,
  getSavedAnnotationsForDiff,
  loadSavedAnnotations,
  persistSavedAnnotations,
  pruneSavedAnnotationsForDiff,
  pruneSavedAnnotationsForFiles,
  removeSavedAnnotation,
  type SavedDiffAnnotation,
  upsertSavedAnnotation,
} from "@/app/diff-viewer/annotations"
import {
  commitStaged,
  fetchBranches,
  fetchChangedFiles,
  fetchFileDiff,
  pushCurrentBranch,
  stageFile,
  unstageFile,
  type BranchOption,
  type ChangedFileItem,
  type ChangedFilesResult,
  type ComparisonMode,
  type FileDiffResult,
} from "@/app/changed-files/api"
import { DiffViewerToolbar } from "@/app/diff-viewer/DiffViewerToolbar"
import { AppSidebar } from "@/components/app-sidebar"
import { DiffPane } from "@/components/diff/DiffPane"
import { SiteHeader } from "@/components/site-header"
import { toast } from "@/components/ui/sonner"
import { useRepoEventsRefresh } from "@/app/diff-viewer/useRepoEventsRefresh"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import {
  clonePreparedFileDiff,
  type PreparedFileDiffResult,
} from "@/components/diff/prepareDiff"
import { prepareFileDiffAsync } from "@/components/diff/prepareDiffAsync"
import { getToastErrorDescription } from "@/lib/toast-errors"
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react"

function createDiffCacheKey(baseCommit: string, file: Pick<ChangedFileItem, "path" | "contentKey">) {
  return `${baseCommit}:${file.path}:${file.contentKey}`
}

type InlineAnnotationTarget = Pick<SavedDiffAnnotation, "side" | "lineNumber">

export function DiffViewerPage() {
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>("head")
  const [selectedBaseRef, setSelectedBaseRef] = useState("HEAD")
  const [baseCommit, setBaseCommit] = useState("")
  const [workspaceName, setWorkspaceName] = useState("workspace")
  const [scopePath, setScopePath] = useState(".")
  const [hiddenStagedFileCount, setHiddenStagedFileCount] = useState(0)
  const [branches, setBranches] = useState<BranchOption[]>([])
  const [branchesError, setBranchesError] = useState<string | null>(null)
  const [isBranchesLoading, setIsBranchesLoading] = useState(true)
  const [files, setFiles] = useState<ChangedFileItem[]>([])
  const [filesError, setFilesError] = useState<string | null>(null)
  const [isFilesLoading, setIsFilesLoading] = useState(true)
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<"unified" | "split">("split")
  const [isCurrentFileExpanded, setIsCurrentFileExpanded] = useState(false)
  const [displayedDiff, setDisplayedDiff] = useState<PreparedFileDiffResult | null>(null)
  const [diffError, setDiffError] = useState<string | null>(null)
  const [isDiffLoading, setIsDiffLoading] = useState(false)
  const [savedAnnotations, setSavedAnnotations] = useState<SavedDiffAnnotation[]>(() =>
    loadSavedAnnotations()
  )
  const [copyState, setCopyState] = useState<"idle" | "copying" | "success" | "error">("idle")
  const [clearDraftToken, setClearDraftToken] = useState(0)
  const [stagePendingPaths, setStagePendingPaths] = useState<string[]>([])
  const [commitMessage, setCommitMessage] = useState("")
  const [isCommitPending, setIsCommitPending] = useState(false)
  const [isPushPending, setIsPushPending] = useState(false)
  const [showPushAction, setShowPushAction] = useState(false)
  const selectedFilePathRef = useRef<string | null>(null)
  const diffCacheRef = useRef(new Map<string, PreparedFileDiffResult>())
  const diffPrepareRequestCacheRef = useRef(new Map<string, Promise<PreparedFileDiffResult>>())
  const diffRequestCacheRef = useRef(new Map<string, Promise<PreparedFileDiffResult>>())
  const diffAbortRef = useRef<AbortController | null>(null)
  const copyStateTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    selectedFilePathRef.current = selectedFilePath
  }, [selectedFilePath])

  useEffect(() => {
    persistSavedAnnotations(savedAnnotations)
  }, [savedAnnotations])

  useEffect(() => {
    return () => {
      if (copyStateTimeoutRef.current != null) {
        window.clearTimeout(copyStateTimeoutRef.current)
      }
    }
  }, [])

  const readCachedDiff = useCallback((cacheKey: string) => {
    const cachedDiff = diffCacheRef.current.get(cacheKey)
    if (!cachedDiff) {
      return null
    }

    return clonePreparedFileDiff(cachedDiff)
  }, [])

  const prepareLoadedDiff = useCallback(
    (
      nextHeadCommit: string,
      file: Pick<ChangedFileItem, "path" | "contentKey">,
      diff: FileDiffResult
    ) => {
      const cacheKey = createDiffCacheKey(nextHeadCommit, file)
      const cachedDiff = readCachedDiff(cacheKey)
      if (cachedDiff) {
        return Promise.resolve(cachedDiff)
      }

      const inFlightRequest = diffPrepareRequestCacheRef.current.get(cacheKey)
      if (inFlightRequest) {
        return inFlightRequest
      }

      const request = prepareFileDiffAsync(diff)
        .then((preparedDiff) => {
          diffCacheRef.current.set(cacheKey, clonePreparedFileDiff(preparedDiff))
          return preparedDiff
        })
        .finally(() => {
          diffPrepareRequestCacheRef.current.delete(cacheKey)
        })

      diffPrepareRequestCacheRef.current.set(cacheKey, request)

      return request
    },
    [readCachedDiff]
  )

  const loadDiff = useCallback(
    (
      nextBaseRef: string,
      nextBaseCommit: string,
      file: Pick<ChangedFileItem, "path" | "previousPath" | "status" | "contentKey">,
      signal?: AbortSignal
    ) => {
      const cacheKey = createDiffCacheKey(nextBaseCommit, file)
      const cachedDiff = readCachedDiff(cacheKey)
      if (cachedDiff) {
        return Promise.resolve(cachedDiff)
      }

      const inFlightRequest = diffRequestCacheRef.current.get(cacheKey)
      if (inFlightRequest) {
        return inFlightRequest
      }

      const request = fetchFileDiff(file, nextBaseRef, signal)
        .then((result) => prepareLoadedDiff(nextBaseCommit, file, result))
        .finally(() => {
          diffRequestCacheRef.current.delete(cacheKey)
        })

      diffRequestCacheRef.current.set(cacheKey, request)

      return request
    },
    [prepareLoadedDiff, readCachedDiff]
  )

  const refreshBranches = useCallback(
    async (signal?: AbortSignal) => {
      const result = await fetchBranches(signal)
      setBranches(result.branches)
      setBranchesError(null)
    },
    []
  )

  const applyChangedFilesResult = useCallback(
    (result: ChangedFilesResult) => {
      const initialDiff = result.initialDiff ?? null
      const nextSelectedPath =
        selectedFilePathRef.current && result.files.some((file) => file.path === selectedFilePathRef.current)
          ? selectedFilePathRef.current
          : result.files[0]?.path ?? null
      const nextSelectedFile =
        result.files.find((file) => file.path === nextSelectedPath) ?? result.files[0] ?? null
      const initialDiffFile = initialDiff
        ? result.files.find((file) => file.path === initialDiff.path) ?? null
        : null

      setComparisonMode(result.mode)
      setBaseCommit(result.baseCommit)
      setWorkspaceName(result.workspaceName)
      setScopePath(result.scopePath)
      setHiddenStagedFileCount(result.hiddenStagedFileCount)
      setFiles(result.files)
      setSavedAnnotations((currentAnnotations) =>
        pruneSavedAnnotationsForFiles(currentAnnotations, result.files)
      )
      setFilesError(null)
      setSelectedFilePath(nextSelectedPath)

      if (initialDiff && initialDiffFile) {
        void prepareLoadedDiff(result.baseCommit, initialDiffFile, initialDiff).catch(() => undefined)
      }

      if (!nextSelectedFile) {
        setDisplayedDiff(null)
        setDiffError(null)
        setIsDiffLoading(false)
      }
    },
    [prepareLoadedDiff]
  )

  const refreshChangedFiles = useCallback(
    async (signal?: AbortSignal) => {
      const result = await fetchChangedFiles(selectedBaseRef, signal)
      applyChangedFilesResult(result)
    },
    [applyChangedFilesResult, selectedBaseRef]
  )

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
    []
  )

  useRepoEventsRefresh({
    refreshChangedFiles,
    refreshBranches,
    onError: handleLiveRefreshError,
  })

  useEffect(() => {
    const controller = new AbortController()

    refreshBranches(controller.signal)
      .catch((error: Error) => {
        if (controller.signal.aborted) {
          return
        }

        setBranches([])
        setBranchesError(error.message)
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsBranchesLoading(false)
        }
      })

    return () => controller.abort()
  }, [refreshBranches])

  useEffect(() => {
    const controller = new AbortController()

    refreshChangedFiles(controller.signal)
      .catch((error: Error) => {
        if (controller.signal.aborted) {
          return
        }

        setComparisonMode("head")
        setBaseCommit("")
        setWorkspaceName("workspace")
        setScopePath(".")
        setHiddenStagedFileCount(0)
        setFiles([])
        setDisplayedDiff(null)
        setDiffError(null)
        setFilesError(error.message)
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsFilesLoading(false)
        }
      })

    return () => controller.abort()
  }, [refreshChangedFiles])

  const selectedFile =
    files.find((file) => file.path === selectedFilePath) ?? files[0] ?? null

  const currentDisplayedDiff =
    displayedDiff &&
    selectedFile &&
    displayedDiff.path === selectedFile.path &&
    (displayedDiff.previousPath ?? "") === (selectedFile.previousPath ?? "") &&
    displayedDiff.status === selectedFile.status
      ? displayedDiff
      : null

  useEffect(() => {
    setIsCurrentFileExpanded(false)
  }, [baseCommit, selectedFile?.contentKey, selectedFile?.path])

  const resetCopyState = useCallback((nextState: "success" | "error") => {
    setCopyState(nextState)
    if (copyStateTimeoutRef.current != null) {
      window.clearTimeout(copyStateTimeoutRef.current)
    }

    copyStateTimeoutRef.current = window.setTimeout(() => {
      setCopyState("idle")
      copyStateTimeoutRef.current = null
    }, 2000)
  }, [])

  const handleSelectBaseRef = useCallback((nextBaseRef: string) => {
    setSelectedBaseRef(nextBaseRef)
    setIsFilesLoading(true)
  }, [])

  const handleExpandCurrentFile = useCallback(() => {
    setIsCurrentFileExpanded(true)
  }, [])

  useEffect(() => {
    if (!selectedFile || !baseCommit) {
      diffAbortRef.current?.abort()
      return
    }

    diffAbortRef.current?.abort()

    const cacheKey = createDiffCacheKey(baseCommit, selectedFile)
    const cachedDiff = readCachedDiff(cacheKey)
    const controller = new AbortController()
    diffAbortRef.current = controller
    if (!cachedDiff) {
      queueMicrotask(() => {
        if (controller.signal.aborted) {
          return
        }

        setDiffError(null)
        setIsDiffLoading(true)
      })
    }

    const inFlightPreparedDiff = diffPrepareRequestCacheRef.current.get(cacheKey)
    const request = cachedDiff
      ? Promise.resolve(cachedDiff)
      : inFlightPreparedDiff ?? loadDiff(selectedBaseRef, baseCommit, selectedFile, controller.signal)

    request
      .then((result) => {
        if (controller.signal.aborted) {
          return
        }

        setSavedAnnotations((currentAnnotations) =>
          pruneSavedAnnotationsForDiff(currentAnnotations, result)
        )
        setDisplayedDiff(result)
        setIsDiffLoading(false)
      })
      .catch((error: Error) => {
        if (controller.signal.aborted) {
          return
        }

        setDisplayedDiff(null)
        setDiffError(error.message)
        setIsDiffLoading(false)
      })

    return () => controller.abort()
  }, [baseCommit, loadDiff, readCachedDiff, selectedBaseRef, selectedFile])

  const visibleSavedAnnotations = currentDisplayedDiff
    ? getSavedAnnotationsForDiff(savedAnnotations, currentDisplayedDiff)
    : []

  const handleSaveAnnotation = useCallback(
    (target: InlineAnnotationTarget, comment: string) => {
      if (!selectedFile || !currentDisplayedDiff) {
        return
      }

      const nextAnnotation = createSavedAnnotation({
        ...target,
        path: currentDisplayedDiff.path,
        previousPath: currentDisplayedDiff.previousPath,
        status: currentDisplayedDiff.status,
        comment,
        contentKey: selectedFile.contentKey,
        baseRef: currentDisplayedDiff.baseRef,
        baseCommit: currentDisplayedDiff.baseCommit,
        beforeCacheKey: currentDisplayedDiff.before.cacheKey,
        afterCacheKey: currentDisplayedDiff.after.cacheKey,
        patchMetadata: findPatchMetadataForAnnotation(currentDisplayedDiff, target),
      })

      if (!nextAnnotation) {
        return
      }

      setSavedAnnotations((currentAnnotations) =>
        upsertSavedAnnotation(currentAnnotations, nextAnnotation)
      )
    },
    [currentDisplayedDiff, selectedFile]
  )

  const handleDeleteAnnotation = useCallback(
    (target: InlineAnnotationTarget) => {
      if (!currentDisplayedDiff) {
        return
      }

      setSavedAnnotations((currentAnnotations) =>
        removeSavedAnnotation(currentAnnotations, {
          ...target,
          path: currentDisplayedDiff.path,
          previousPath: currentDisplayedDiff.previousPath,
          status: currentDisplayedDiff.status,
        })
      )
    },
    [currentDisplayedDiff]
  )

  const handleCopyAnnotations = useCallback(async () => {
    if (savedAnnotations.length === 0) {
      return
    }

    setCopyState("copying")

    try {
      await navigator.clipboard.writeText(formatSavedAnnotationsForCopy(savedAnnotations))
      setSavedAnnotations([])
      setClearDraftToken((current) => current + 1)
      resetCopyState("success")
    } catch {
      resetCopyState("error")
    }
  }, [resetCopyState, savedAnnotations])

  const handleToggleStage = useCallback(
    async (file: ChangedFileItem) => {
      setStagePendingPaths((current) => [...current, file.path])

      try {
        if (file.hasStagedChanges) {
          await unstageFile(file)
        } else {
          await stageFile(file)
        }

        await refreshChangedFiles()
      } catch (error) {
        toast.error("Couldn’t stage file.", {
          description: getToastErrorDescription(error, `Unable to update ${file.displayPath}.`),
        })
      } finally {
        setStagePendingPaths((current) => current.filter((path) => path !== file.path))
      }
    },
    [refreshChangedFiles]
  )

  const handleCommit = useCallback(async () => {
    setIsCommitPending(true)
    const commitToastId = toast.warning("Creating commit...", {
      duration: Infinity,
      dismissible: false,
    })

    try {
      const result = await commitStaged(commitMessage)
      setCommitMessage("")
      setShowPushAction(true)
      toast.success(`Created commit ${result.commit.slice(0, 7)}.`, {
        id: commitToastId,
      })
      await Promise.all([refreshChangedFiles(), refreshBranches()])
    } catch (error) {
      toast.error("Commit failed.", {
        id: commitToastId,
        description: getToastErrorDescription(error, "Unable to create the commit."),
      })
    } finally {
      setIsCommitPending(false)
    }
  }, [commitMessage, refreshBranches, refreshChangedFiles])

  const handlePush = useCallback(async () => {
    setIsPushPending(true)
    const pushToastId = toast.warning("Pushing branch...", {
      duration: Infinity,
      dismissible: false,
    })

    try {
      const result = await pushCurrentBranch()
      setShowPushAction(false)
      toast.success(`Pushed ${result.remoteRef}.`, {
        id: pushToastId,
      })
      await Promise.all([refreshChangedFiles(), refreshBranches()])
    } catch (error) {
      toast.error("Push failed.", {
        id: pushToastId,
        description: getToastErrorDescription(error, "Unable to push the current branch."),
      })
    } finally {
      setIsPushPending(false)
    }
  }, [refreshBranches, refreshChangedFiles])

  const headerError =
    filesError && !isFilesLoading
      ? filesError
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
        workspaceName={workspaceName}
        scopePath={scopePath}
        branches={branches}
        comparisonMode={comparisonMode}
        selectedBaseRef={selectedBaseRef}
        onSelectBaseRef={handleSelectBaseRef}
        isBranchesLoading={isBranchesLoading}
        branchesError={branchesError}
        selectedFilePath={selectedFilePath}
        onSelectFile={setSelectedFilePath}
        hiddenStagedFileCount={hiddenStagedFileCount}
        stagePendingPaths={stagePendingPaths}
        onToggleStage={handleToggleStage}
        commitMessage={commitMessage}
        isCommitPending={isCommitPending}
        onCommitMessageChange={setCommitMessage}
        onCommit={handleCommit}
        isPushPending={isPushPending}
        showPushAction={showPushAction}
        onPush={handlePush}
        variant="inset"
      />
      <SidebarInset>
        <SiteHeader
          scopePath={scopePath}
          copyState={copyState}
          canCopyAnnotations={savedAnnotations.length > 0}
          onCopyAnnotations={handleCopyAnnotations}
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
                  onExpandAll={handleExpandCurrentFile}
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
                onSaveAnnotation={handleSaveAnnotation}
                onDeleteAnnotation={handleDeleteAnnotation}
              />
            </div>
          </section>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
