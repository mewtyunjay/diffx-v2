import {
  fetchChangedFiles,
  fetchFileContent,
  type ChangedFileItem,
  type FileContentResult,
} from "@/app/changed-files/api"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { ThemeProvider } from "@/components/theme-provider"
import { TooltipProvider } from "@/components/ui/tooltip"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { useEffect, useRef, useState, type CSSProperties } from "react"

type CachedFileContent = FileContentResult & {
  path: string
}

const EMPTY_CONTENT = "Select a file to preview."

function App() {
  const [files, setFiles] = useState<ChangedFileItem[]>([])
  const [filesError, setFilesError] = useState<string | null>(null)
  const [isFilesLoading, setIsFilesLoading] = useState(true)
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null)
  const [displayedContent, setDisplayedContent] = useState<CachedFileContent>({
    path: "",
    contentKey: "",
    text: EMPTY_CONTENT,
  })
  const [contentError, setContentError] = useState<string | null>(null)
  const [isContentLoading, setIsContentLoading] = useState(false)
  const contentCacheRef = useRef(new Map<string, CachedFileContent>())
  const inflightContentRef = useRef(new Map<string, Promise<FileContentResult>>())
  const contentAbortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    fetchChangedFiles(controller.signal)
      .then((nextFiles) => {
        setFiles(nextFiles)
        setFilesError(null)
        setSelectedFilePath((currentPath) => {
          if (currentPath && nextFiles.some((file) => file.path === currentPath)) {
            return currentPath
          }
          return nextFiles[0]?.path ?? null
        })
      })
      .catch((error: Error) => {
        if (controller.signal.aborted) {
          return
        }
        setFilesError(error.message)
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsFilesLoading(false)
        }
      })

    return () => controller.abort()
  }, [])

  const selectedFile =
    files.find((file) => file.path === selectedFilePath) ?? files[0] ?? null

  useEffect(() => {
    if (!selectedFile) {
      return
    }

    const cacheKey = `${selectedFile.path}::${selectedFile.contentKey}`
    const cachedContent = contentCacheRef.current.get(cacheKey)
    if (cachedContent) {
      setDisplayedContent(cachedContent)
      setContentError(null)
      setIsContentLoading(false)
      return
    }

    contentAbortRef.current?.abort()

    const controller = new AbortController()
    contentAbortRef.current = controller
    setContentError(null)
    setIsContentLoading(true)

    let request = inflightContentRef.current.get(cacheKey)
    if (!request) {
      request = fetchFileContent(
        selectedFile.path,
        selectedFile.contentKey,
        controller.signal
      ).finally(() => {
        inflightContentRef.current.delete(cacheKey)
      })
      inflightContentRef.current.set(cacheKey, request)
    }

    request
      .then((result) => {
        if (controller.signal.aborted) {
          return
        }

        const nextContent = {
          path: selectedFile.path,
          contentKey: result.contentKey,
          text: result.text,
        } satisfies CachedFileContent

        contentCacheRef.current.set(cacheKey, nextContent)
        setDisplayedContent(nextContent)
        setIsContentLoading(false)
      })
      .catch((error: Error) => {
        if (controller.signal.aborted) {
          return
        }

        setDisplayedContent({
          path: selectedFile.path,
          contentKey: selectedFile.contentKey,
          text: "Content unavailable.",
        })
        setContentError(error.message)
        setIsContentLoading(false)
      })

    return () => controller.abort()
  }, [filesError, selectedFile])

  const isShowingStaleContent =
    isContentLoading &&
    !!selectedFile &&
    displayedContent.path !== "" &&
    displayedContent.path !== selectedFile.path
  const mainPanelText = selectedFile
    ? displayedContent.text
    : filesError ?? (isFilesLoading ? "Loading files..." : EMPTY_CONTENT)

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
            <main className="flex min-h-0 flex-1 flex-col p-4">
              <section className="flex flex-1 flex-col rounded-xl border border-border/50 bg-card/30 shadow-sm">
                <div className="border-b border-border/60 px-5 py-4">
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                    Plain text preview
                  </p>
                  <h1 className="mt-2 text-xl font-semibold text-foreground">
                    {selectedFile?.path ??
                      (isFilesLoading ? "Loading files..." : "No file selected")}
                  </h1>
                  {selectedFile ? (
                    <p className="mt-2 text-sm text-muted-foreground">
                      {selectedFile.isTracked ? "tracked" : "untracked"} ·{" "}
                      {selectedFile.hasStagedChanges ? "staged" : "not staged"} ·{" "}
                      {selectedFile.hasUnstagedChanges
                        ? "has unstaged changes"
                        : "no unstaged changes"}
                    </p>
                  ) : null}
                  {isShowingStaleContent ? (
                    <p className="mt-2 text-sm text-muted-foreground">
                      Loading content...
                    </p>
                  ) : null}
                  {contentError && !isContentLoading ? (
                    <p className="mt-2 text-sm text-destructive">{contentError}</p>
                  ) : null}
                </div>
                <div className="min-h-0 flex-1 overflow-auto p-5">
                  <pre className="font-mono text-sm leading-6 whitespace-pre-wrap text-foreground">
                    {mainPanelText}
                  </pre>
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
