import type { CSSProperties } from "react"
import { FolderTree, SlidersHorizontal } from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { SidebarFileTree } from "@/components/file-tree/SidebarFileTree"
import { experimentalSidebarTree } from "@/app/experimental/sidebar/sidebarTreeData"

type SidebarSandboxPreviewProps = {
  selectedPath: string
  expandedPaths: string[]
  sidebarWidth: number
  indent: number
  density: "compact" | "comfortable"
  stageWidth: number
  stageHeight: number
  stageBackgroundClassName: string
  backdrop: string
  onToggleFolder: (path: string) => void
  onSelectFile: (path: string) => void
}

function getSelectedPathDetails(path: string) {
  const segments = path.split("/")

  return {
    name: segments.at(-1) ?? path,
    parentPath: segments.slice(0, -1).join("/"),
    depth: Math.max(segments.length - 1, 0),
  }
}

export function SidebarSandboxPreview({
  selectedPath,
  expandedPaths,
  sidebarWidth,
  indent,
  density,
  stageWidth,
  stageHeight,
  stageBackgroundClassName,
  backdrop,
  onToggleFolder,
  onSelectFile,
}: SidebarSandboxPreviewProps) {
  const selectedPathDetails = getSelectedPathDetails(selectedPath)

  return (
    <div
      className={`relative w-full overflow-hidden rounded-[1.35rem] border border-border/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ${stageBackgroundClassName}`}
      style={{
        maxWidth: `${stageWidth}px`,
        height: `${stageHeight}px`,
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.03),_transparent_60%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center px-6 py-6">
        <div className="rounded-full border border-border/60 bg-background/50 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground backdrop-blur">
          Sidebar preview
        </div>
      </div>

      <div className="relative h-full p-5">
        <div className="h-full overflow-hidden rounded-[1.2rem] border border-border/60 bg-background/75 shadow-[0_24px_80px_rgba(15,23,42,0.36)] backdrop-blur">
          <SidebarProvider
            className="h-full"
            style={
              {
                "--sidebar-width": `${sidebarWidth}px`,
              } as CSSProperties
            }
          >
            <Sidebar
              collapsible="none"
              className="border-r border-sidebar-border/70 bg-sidebar/95 backdrop-blur"
            >
              <SidebarHeader className="gap-3 border-b border-sidebar-border/70 p-3">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl border border-sidebar-border/70 bg-sidebar-accent/60 p-2 text-sidebar-primary">
                    <FolderTree className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-sidebar-foreground/65">
                      Root folder
                    </p>
                    <p className="mt-1 text-sm font-semibold text-sidebar-foreground">diffx-v2</p>
                    <p className="mt-1 text-xs leading-5 text-sidebar-foreground/60">
                      Nested from cwd with folders first, visible structure, and quick file
                      targeting.
                    </p>
                  </div>
                </div>
              </SidebarHeader>

              <SidebarContent className="pb-4">
                <SidebarGroup className="p-2">
                  <SidebarGroupLabel>Repo tree</SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarFileTree
                      root={experimentalSidebarTree}
                      expandedPaths={expandedPaths}
                      selectedPath={selectedPath}
                      indent={indent}
                      density={density}
                      onToggleFolder={onToggleFolder}
                      onSelectFile={(path) => onSelectFile(path)}
                    />
                  </SidebarGroupContent>
                </SidebarGroup>
              </SidebarContent>
            </Sidebar>

            <SidebarInset className="min-w-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(248,250,252,0.86))] dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(15,23,42,0.72))]">
              <div className="flex h-full min-h-0 flex-col">
                <div className="border-b border-border/60 px-6 py-5">
                  <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    Selected path
                  </p>
                  <h2 className="mt-2 text-xl font-semibold tracking-tight text-foreground">
                    {selectedPathDetails.name}
                  </h2>
                  <p className="mt-2 max-w-3xl break-all text-sm leading-6 text-muted-foreground">
                    {selectedPath}
                  </p>
                </div>

                <div className="grid min-h-0 flex-1 gap-4 p-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(260px,0.95fr)]">
                  <section className="flex min-h-0 flex-col justify-between rounded-[1.2rem] border border-border/60 bg-card/80 p-6 shadow-[0_12px_50px_rgba(15,23,42,0.12)]">
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                        Preview notes
                      </p>
                      <p className="mt-4 text-pretty text-3xl font-semibold leading-tight text-foreground">
                        Indentation stays readable from repo root through nested feature and backend
                        paths.
                      </p>
                      <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground">
                        The sidebar keeps folder icons forward, lets file names carry the scan path,
                        and uses a denser rhythm than the primary app shell so it feels closer to an
                        editor.
                      </p>
                    </div>

                    <div className="mt-8 flex flex-wrap gap-2">
                      <span className="rounded-full border border-border/70 bg-background/80 px-3 py-1 text-xs font-medium text-foreground">
                        parent {selectedPathDetails.parentPath || "repo root"}
                      </span>
                      <span className="rounded-full border border-border/70 bg-background/80 px-3 py-1 text-xs font-medium text-foreground">
                        depth {selectedPathDetails.depth}
                      </span>
                      <span className="rounded-full border border-border/70 bg-background/80 px-3 py-1 text-xs font-medium text-foreground">
                        indent {indent}px
                      </span>
                    </div>
                  </section>

                  <section className="flex flex-col gap-4">
                    <div className="rounded-[1.1rem] border border-border/60 bg-card/70 p-5 shadow-[0_12px_40px_rgba(15,23,42,0.1)]">
                      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <SlidersHorizontal className="size-4 text-primary" />
                        Tree metrics
                      </div>
                      <dl className="mt-4 space-y-3 text-sm">
                        <div className="flex items-center justify-between gap-4">
                          <dt className="text-muted-foreground">Sidebar width</dt>
                          <dd className="font-medium text-foreground">{sidebarWidth}px</dd>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <dt className="text-muted-foreground">Row density</dt>
                          <dd className="font-medium capitalize text-foreground">{density}</dd>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <dt className="text-muted-foreground">Backdrop</dt>
                          <dd className="font-medium capitalize text-foreground">{backdrop}</dd>
                        </div>
                      </dl>
                    </div>

                    <div className="rounded-[1.1rem] border border-dashed border-border/70 bg-background/65 p-5">
                      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                        Why this exists
                      </p>
                      <p className="mt-3 text-sm leading-6 text-muted-foreground">
                        This sandbox is for tree spacing, nested path legibility, and icon balance.
                        It stays static on purpose so you can tune the visual behavior before wiring
                        a live filesystem source.
                      </p>
                    </div>
                  </section>
                </div>
              </div>
            </SidebarInset>
          </SidebarProvider>
        </div>
      </div>
    </div>
  )
}
