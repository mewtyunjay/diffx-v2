import { preloadHighlighter, type SupportedLanguages } from "@pierre/diffs"
import {
  fetchChangedFiles,
  fetchFileDiff,
  type ChangedFileItem,
  type ChangedFileStatus,
  type FileDiffResult,
} from "@/app/changed-files/api"
import { AppSidebar } from "@/components/app-sidebar"
import { DiffPane } from "@/components/diff/DiffPane"
import { SiteHeader } from "@/components/site-header"
import { ThemeProvider } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"
import { TooltipProvider } from "@/components/ui/tooltip"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react"

const HIGH_PRIORITY_LANGUAGE_PRELOAD_COUNT = 5

function createDiffCacheKey(headCommit: string, file: Pick<ChangedFileItem, "path" | "contentKey">) {
  return `${headCommit}:${file.path}:${file.contentKey}`
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

function toSupportedLanguage(language?: string) {
  return (language ?? "text") as SupportedLanguages
}

function App() {
  const [headCommit, setHeadCommit] = useState("")
  const [files, setFiles] = useState<ChangedFileItem[]>([])
  const [filesError, setFilesError] = useState<string | null>(null)
  const [isFilesLoading, setIsFilesLoading] = useState(true)
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<"unified" | "split">("unified")
  const [displayedDiff, setDisplayedDiff] = useState<FileDiffResult | null>(null)
  const [diffError, setDiffError] = useState<string | null>(null)
  const [isDiffLoading, setIsDiffLoading] = useState(false)
  const selectedFilePathRef = useRef<string | null>(null)
  const diffCacheRef = useRef(new Map<string, FileDiffResult>())
  const diffRequestCacheRef = useRef(new Map<string, Promise<FileDiffResult>>())
  const diffAbortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    selectedFilePathRef.current = selectedFilePath
  }, [selectedFilePath])

  const loadDiff = useCallback(
    (
      nextHeadCommit: string,
      file: Pick<ChangedFileItem, "path" | "previousPath" | "status" | "contentKey">,
      signal?: AbortSignal
    ) => {
      const cacheKey = createDiffCacheKey(nextHeadCommit, file)
      const cachedDiff = diffCacheRef.current.get(cacheKey)
      if (cachedDiff) {
        return Promise.resolve(cachedDiff)
      }

      const inFlightRequest = diffRequestCacheRef.current.get(cacheKey)
      if (inFlightRequest) {
        return inFlightRequest
      }

      const request = fetchFileDiff(file, signal)
        .then((result) => {
          diffCacheRef.current.set(cacheKey, result)
          return result
        })
        .finally(() => {
          diffRequestCacheRef.current.delete(cacheKey)
        })

      diffRequestCacheRef.current.set(cacheKey, request)

      return request
    },
    []
  )

  useEffect(() => {
    const controller = new AbortController()

    fetchChangedFiles(controller.signal)
      .then((result) => {
        const nextSelectedPath =
          selectedFilePathRef.current &&
          result.files.some((file) => file.path === selectedFilePathRef.current)
            ? selectedFilePathRef.current
            : result.files[0]?.path ?? null
        const nextSelectedFile =
          result.files.find((file) => file.path === nextSelectedPath) ?? result.files[0] ?? null

        setHeadCommit(result.headCommit)
        setFiles(result.files)
        setFilesError(null)
        setSelectedFilePath(nextSelectedPath)

        if (nextSelectedFile) {
          void loadDiff(result.headCommit, nextSelectedFile, controller.signal).catch(
            () => undefined
          )
        }
      })
      .catch((error: Error) => {
        if (controller.signal.aborted) {
          return
        }

        setHeadCommit("")
        setFiles([])
        setFilesError(error.message)
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsFilesLoading(false)
        }
      })

    return () => controller.abort()
  }, [loadDiff])

  const selectedFile =
    files.find((file) => file.path === selectedFilePath) ?? files[0] ?? null

  const preloadLanguages = useMemo(() => {
    const nextLanguages = new Set<SupportedLanguages>(["text"])

    files.slice(0, HIGH_PRIORITY_LANGUAGE_PRELOAD_COUNT).forEach((file) => {
      nextLanguages.add(toSupportedLanguage(file.language))
    })

    if (selectedFile) {
      nextLanguages.add(toSupportedLanguage(selectedFile.language))
    }

    return Array.from(nextLanguages)
  }, [files, selectedFile])

  useEffect(() => {
    preloadHighlighter({
      themes: ["pierre-dark"],
      langs: preloadLanguages,
    }).catch(() => undefined)
  }, [preloadLanguages])

  useEffect(() => {
    if (!selectedFile || !headCommit) {
      diffAbortRef.current?.abort()
      return
    }

    const cacheKey = createDiffCacheKey(headCommit, selectedFile)
    const cachedDiff = diffCacheRef.current.get(cacheKey)
    if (cachedDiff) {
      setDisplayedDiff(cachedDiff)
      setDiffError(null)
      setIsDiffLoading(false)
      return
    }

    diffAbortRef.current?.abort()

    const controller = new AbortController()
    diffAbortRef.current = controller
    setDiffError(null)
    setIsDiffLoading(true)

    loadDiff(headCommit, selectedFile, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) {
          return
        }

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
  }, [headCommit, loadDiff, selectedFile])

  const isShowingStaleDiff =
    isDiffLoading &&
    !!selectedFile &&
    !!displayedDiff &&
    (displayedDiff.path !== selectedFile.path || displayedDiff.headCommit !== headCommit)

  return (
    <ThemeProvider>
      <TooltipProvider>
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
            selectedFilePath={selectedFilePath}
            onSelectFile={setSelectedFilePath}
            variant="inset"
          />
          <SidebarInset>
            <SiteHeader />
            <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-4">
              <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-border/50 bg-card/30 shadow-sm">
                <div className="flex flex-col gap-4 border-b border-border/60 px-5 py-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      Fast file diff
                    </p>
                    <h1 className="mt-2 text-xl font-semibold text-foreground">
                      {selectedFile?.path ??
                        (isFilesLoading ? "Loading files..." : "No file selected")}
                    </h1>
                    {selectedFile ? (
                      <>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {formatStatus(selectedFile.status)} ·{" "}
                          {selectedFile.isTracked ? "tracked" : "untracked"} ·{" "}
                          {selectedFile.hasStagedChanges ? "staged" : "not staged"} ·{" "}
                          {selectedFile.hasUnstagedChanges
                            ? "has unstaged changes"
                            : "no unstaged changes"}
                        </p>
                        {selectedFile.previousPath ? (
                          <p className="mt-1 text-sm text-muted-foreground">
                            from {selectedFile.previousPath}
                          </p>
                        ) : null}
                      </>
                    ) : null}
                    {isShowingStaleDiff ? (
                      <p className="mt-2 text-sm text-muted-foreground">
                        Loading diff...
                      </p>
                    ) : null}
                    {filesError && !isFilesLoading ? (
                      <p className="mt-2 text-sm text-destructive">{filesError}</p>
                    ) : null}
                    {selectedFile && diffError && !isDiffLoading ? (
                      <p className="mt-2 text-sm text-destructive">{diffError}</p>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-2 self-start rounded-lg border border-border/70 bg-background/60 p-1">
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

                <div className="min-h-0 min-w-0 flex-1 overflow-auto p-5">
                  {isDiffLoading && !displayedDiff ? (
                    <div className="flex h-full min-h-0 items-center justify-center rounded-lg border border-dashed border-border/60 bg-background/40 px-6 text-center text-sm text-muted-foreground">
                      Loading diff...
                    </div>
                  ) : (
                    <DiffPane diff={selectedFile ? displayedDiff : null} viewMode={viewMode} />
                  )}
                </div>
              </section>
            </main>
          </SidebarInset>
        </SidebarProvider>
      </TooltipProvider>
    </ThemeProvider>
  )
}

export default App
