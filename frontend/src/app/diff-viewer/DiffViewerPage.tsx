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
  type ChangedFileStatus,
  type ComparisonMode,
  type FileDiffResult,
} from "@/app/changed-files/api"
import { AppSidebar } from "@/components/app-sidebar"
import { DiffPane } from "@/components/diff/DiffPane"
import { SiteHeader } from "@/components/site-header"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/sonner"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import {
  clonePreparedFileDiff,
  type PreparedFileDiffResult,
} from "@/components/diff/prepareDiff"
import { prepareFileDiffAsync } from "@/components/diff/prepareDiffAsync"
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react"

function createDiffCacheKey(baseCommit: string, file: Pick<ChangedFileItem, "path" | "contentKey">) {
  return `${baseCommit}:${file.path}:${file.contentKey}`
}

function formatStatus(status: ChangedFileStatus) {
  switch (status) {
    case "added":
      return "added"
    case "deleted":
      return "deleted"
    case "renamed":
      return "renamed"
    default:
      return "modified"
  }
}

type InlineAnnotationTarget = Pick<SavedDiffAnnotation, "side" | "lineNumber">

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

function getToastErrorDescription(error: unknown, fallback: string) {
  const message = getErrorMessage(error, fallback)

  if (message.includes("path is ignored by git") || message.includes("paths are ignored")) {
    return "Git is ignoring this path."
  }
  if (message.includes("pathspec") && message.includes("did not match any files")) {
    return "Git could not find that path."
  }
  if (message.includes("no staged changes")) {
    return "No staged files are ready to commit."
  }

  const [firstLine] = message
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)

  if (!firstLine) {
    return fallback
  }

  const normalized = firstLine.replace(/^git\s+[^:]+:\s*/, "")
  return normalized.length > 88 ? `${normalized.slice(0, 85)}...` : normalized
}

export function DiffViewerPage() {
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>("head")
  const [selectedBaseRef, setSelectedBaseRef] = useState("HEAD")
  const [baseCommit, setBaseCommit] = useState("")
  const [currentRef, setCurrentRef] = useState("")
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
      setCurrentRef(result.currentRef)
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
      setCurrentRef(result.currentRef)
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
        setCurrentRef("")
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

  const visibleSavedAnnotations = displayedDiff
    ? getSavedAnnotationsForDiff(savedAnnotations, displayedDiff)
    : []

  const handleSaveAnnotation = useCallback(
    (target: InlineAnnotationTarget, comment: string) => {
      if (!selectedFile || !displayedDiff) {
        return
      }

      const nextAnnotation = createSavedAnnotation({
        ...target,
        path: displayedDiff.path,
        previousPath: displayedDiff.previousPath,
        status: displayedDiff.status,
        comment,
        contentKey: selectedFile.contentKey,
        baseRef: displayedDiff.baseRef,
        baseCommit: displayedDiff.baseCommit,
        beforeCacheKey: displayedDiff.before.cacheKey,
        afterCacheKey: displayedDiff.after.cacheKey,
        patchMetadata: findPatchMetadataForAnnotation(displayedDiff, target),
      })

      if (!nextAnnotation) {
        return
      }

      setSavedAnnotations((currentAnnotations) =>
        upsertSavedAnnotation(currentAnnotations, nextAnnotation)
      )
    },
    [displayedDiff, selectedFile]
  )

  const handleDeleteAnnotation = useCallback(
    (target: InlineAnnotationTarget) => {
      if (!displayedDiff) {
        return
      }

      setSavedAnnotations((currentAnnotations) =>
        removeSavedAnnotation(currentAnnotations, {
          ...target,
          path: displayedDiff.path,
          previousPath: displayedDiff.previousPath,
          status: displayedDiff.status,
        })
      )
    },
    [displayedDiff]
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

  const fileSummary =
    comparisonMode === "head"
      ? `${formatStatus(selectedFile?.status ?? "modified")} · ${selectedFile?.isTracked ? "tracked" : "untracked"
      } · ${selectedFile?.hasStagedChanges ? "staged" : "not staged"} · ${selectedFile?.hasUnstagedChanges ? "has unstaged changes" : "no unstaged changes"
      }`
      : selectedFile?.isTracked
        ? `${formatStatus(selectedFile?.status ?? "modified")} relative to ${selectedBaseRef} · current branch ${currentRef}`
        : `untracked in working tree · not present on ${selectedBaseRef}`

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
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-4">
          <section className="surface-panel flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <div className="flex flex-col gap-4 border-b border-border/60 px-5 py-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="type-overline text-muted-foreground">
                  Fast file diff
                </p>
                <h1 className="mt-2 type-title text-foreground">
                  {selectedFile?.path ?? (isFilesLoading ? "Loading files..." : "No file selected")}
                </h1>
                {selectedFile ? (
                  <>
                    <p className="measure-readable mt-2 type-body text-muted-foreground">
                      {fileSummary}
                    </p>
                    {selectedFile.previousPath ? (
                      <p className="measure-readable mt-1 type-meta text-muted-foreground">
                        from {selectedFile.previousPath}
                      </p>
                    ) : null}
                  </>
                ) : null}
                {filesError && !isFilesLoading ? (
                  <p className="measure-readable mt-2 type-meta text-destructive">{filesError}</p>
                ) : null}
                {selectedFile && diffError && !isDiffLoading ? (
                  <p className="measure-readable mt-2 type-meta text-destructive">{diffError}</p>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-2 self-start">
                <Button type="button" size="sm" variant="outline" asChild>
                  <a href="/diffx/experimental">Experimental dock</a>
                </Button>

                <div className="surface-segmented flex items-center gap-2 p-1">
                  <Button
                    type="button"
                    size="sm"
                    variant={viewMode === "unified" ? "secondary" : "ghost"}
                    onClick={() => setViewMode("unified")}
                  >
                    Unified
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={viewMode === "split" ? "secondary" : "ghost"}
                    onClick={() => setViewMode("split")}
                  >
                    Split
                  </Button>
                </div>
              </div>
            </div>

            <div className="min-h-0 min-w-0 flex-1 overflow-auto p-5">
              <DiffPane
                diff={selectedFile ? displayedDiff : null}
                hasSelectedFile={!!selectedFile}
                viewMode={viewMode}
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
