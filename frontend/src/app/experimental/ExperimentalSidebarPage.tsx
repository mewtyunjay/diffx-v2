import { useState } from "react"
import { ArrowLeft, FlaskConical } from "lucide-react"

import { Button } from "@/components/ui/button"
import { DialRoot, useDialKit } from "dialkit"
import "dialkit/styles.css"

import { getExperimentalLinks, STAGE_BACKDROP_OPTIONS, STAGE_BACKGROUNDS } from "@/app/experimental/shared"
import { SidebarSandboxPreview } from "@/app/experimental/sidebar/SidebarSandboxPreview"
import {
  DEFAULT_EXPANDED_PATHS,
  DEFAULT_SELECTED_FILE_PATH,
} from "@/app/experimental/sidebar/sidebarTreeData"

export default function ExperimentalSidebarPage() {
  const [expandedPaths, setExpandedPaths] = useState<string[]>([...DEFAULT_EXPANDED_PATHS])
  const [selectedPath, setSelectedPath] = useState(DEFAULT_SELECTED_FILE_PATH)
  const controls = useDialKit("Sidebar sandbox", {
    stage: {
      width: [1320, 920, 1680, 10],
      height: [820, 560, 980, 10],
      backdrop: {
        type: "select",
        options: [...STAGE_BACKDROP_OPTIONS],
        default: "studio",
      },
    },
    sidebar: {
      width: [344, 260, 520, 4],
    },
    tree: {
      indent: [18, 12, 28, 1],
      density: {
        type: "select",
        options: [
          { value: "comfortable", label: "Comfortable" },
          { value: "compact", label: "Compact" },
        ],
        default: "comfortable",
      },
    },
  })
  const links = getExperimentalLinks(
    typeof window === "undefined" ? "/experimental/sidebar" : window.location.pathname
  )
  const stageBackgroundClassName =
    STAGE_BACKGROUNDS[controls.stage.backdrop as keyof typeof STAGE_BACKGROUNDS] ??
    STAGE_BACKGROUNDS.studio

  function toggleFolder(path: string) {
    setExpandedPaths((currentPaths) =>
      currentPaths.includes(path)
        ? currentPaths.filter((currentPath) => currentPath !== path)
        : [...currentPaths, path]
    )
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-[1820px] flex-col gap-6 p-4 lg:flex-row">
        <section className="flex min-h-0 flex-1 flex-col rounded-[1.5rem] border border-border/60 bg-card/30 shadow-[0_20px_80px_rgba(0,0,0,0.35)]">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border/60 px-6 py-5">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[11px] uppercase tracking-[0.2em] text-primary">
                <FlaskConical className="size-3.5" />
                Experimental
              </div>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
                Sidebar tree sandbox
              </h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                This stage focuses on a repo-root sidebar with nested folders, file rows, and
                indentation that grows from the cwd root. Use DialKit to tune the frame, density,
                and spacing while checking the tree rhythm.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" size="sm" variant="outline" asChild>
                <a href={links.dock}>Open dock sandbox</a>
              </Button>
              <Button type="button" size="sm" variant="outline" asChild>
                <a href={links.diffViewer}>
                  <ArrowLeft className="size-3.5" />
                  Back to diff viewer
                </a>
              </Button>
            </div>
          </div>

          <div className="flex flex-1 items-center justify-center p-6">
            <SidebarSandboxPreview
              selectedPath={selectedPath}
              expandedPaths={expandedPaths}
              sidebarWidth={controls.sidebar.width}
              indent={controls.tree.indent}
              density={controls.tree.density as "compact" | "comfortable"}
              stageWidth={controls.stage.width}
              stageHeight={controls.stage.height}
              stageBackgroundClassName={stageBackgroundClassName}
              backdrop={controls.stage.backdrop}
              onToggleFolder={toggleFolder}
              onSelectFile={setSelectedPath}
            />
          </div>
        </section>

        <aside className="w-full shrink-0 lg:w-[380px]">
          <div className="overflow-hidden rounded-[1.35rem] border border-border/60 bg-card/40 shadow-[0_16px_60px_rgba(0,0,0,0.28)]">
            <div className="border-b border-border/60 px-5 py-4">
              <p className="text-sm font-semibold text-foreground">Dialkit controls</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Tune stage size, sidebar width, row density, and indentation while checking how the
                repo tree feels at a glance.
              </p>
            </div>

            <div className="p-4">
              <DialRoot mode="inline" defaultOpen />
            </div>
          </div>
        </aside>
      </div>
    </main>
  )
}
