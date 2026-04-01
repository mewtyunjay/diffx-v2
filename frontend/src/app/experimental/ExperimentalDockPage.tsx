import { ArrowLeft, FlaskConical } from "lucide-react"

import { useDiffViewerDock } from "@/app/diff-viewer/useDiffViewerDock"
import {
  getExperimentalLinks,
  STAGE_BACKDROP_OPTIONS,
  STAGE_BACKGROUNDS,
} from "@/app/experimental/shared"
import { DiffViewerDock } from "@/components/diff/DiffViewerDock"
import { DiffViewerDockProgress } from "@/components/diff/DiffViewerDockProgress"
import { Button } from "@/components/ui/button"
import { DialRoot, useDialKit } from "dialkit"
import "dialkit/styles.css"

export default function ExperimentalDockPage() {
  const diffViewerDock = useDiffViewerDock("frontend/src/components/diff/DiffViewerDock.tsx")
  const links = getExperimentalLinks(
    typeof window === "undefined" ? "/experimental" : window.location.pathname
  )
  const controls = useDialKit("Dock sandbox", {
    stage: {
      width: [1120, 720, 1480, 10],
      height: [760, 520, 980, 10],
      backdrop: {
        type: "select",
        options: [...STAGE_BACKDROP_OPTIONS],
        default: "studio",
      },
    },
    dock: {
      width: [980, 520, 1320, 10],
      lift: [20, 0, 56, 1],
      scale: [1, 0.8, 1.15, 0.01],
    },
    content: {
      showAuxiliary: true,
    },
  })

  const stageBackgroundClassName =
    STAGE_BACKGROUNDS[controls.stage.backdrop as keyof typeof STAGE_BACKGROUNDS] ??
    STAGE_BACKGROUNDS.studio
  const dockStyle = {
    width: `min(100%, ${controls.dock.width}px)`,
    transform: `translateY(-${controls.dock.lift}px) scale(${controls.dock.scale})`,
    transformOrigin: "center bottom",
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-[1760px] flex-col gap-6 p-4 lg:flex-row">
        <section className="flex min-h-0 flex-1 flex-col rounded-[1.5rem] border border-border/60 bg-card/30 shadow-[0_20px_80px_rgba(0,0,0,0.35)]">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border/60 px-6 py-5">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[11px] uppercase tracking-[0.2em] text-primary">
                <FlaskConical className="size-3.5" />
                Experimental
              </div>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
                Dock component sandbox
              </h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                This page is now just the component stage. Use the dock itself to exercise chat,
                quiz, collapse, and auxiliary content, and use Dialkit to tune the sandbox around it.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" size="sm" variant="outline" asChild>
                <a href={links.sidebar}>Open sidebar sandbox</a>
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
            <div
              className={`relative w-full overflow-hidden rounded-[1.35rem] border border-border/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ${stageBackgroundClassName}`}
              style={{
                maxWidth: `${controls.stage.width}px`,
                minHeight: `${controls.stage.height}px`,
              }}
            >
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.03),_transparent_60%)]" />
              <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center px-6 py-6">
                <div className="rounded-full border border-border/60 bg-background/50 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground backdrop-blur">
                  Component stage only
                </div>
              </div>

              <DiffViewerDock
                mode={diffViewerDock.mode}
                state={diffViewerDock.state}
                title={diffViewerDock.title}
                summary={diffViewerDock.summary}
                onHeaderClick={diffViewerDock.onHeaderClick}
                prompt={diffViewerDock.prompt}
                onPromptChange={diffViewerDock.onPromptChange}
                className="max-w-none"
                style={dockStyle}
                auxiliaryContent={
                  controls.content.showAuxiliary && diffViewerDock.mode === "chat" ? (
                    <DiffViewerDockProgress
                      items={diffViewerDock.progressItems}
                      onToggleItem={diffViewerDock.onToggleProgressItem}
                      onOpenQuiz={diffViewerDock.onOpenQuiz}
                    />
                  ) : undefined
                }
                question={diffViewerDock.question}
                supportingText={diffViewerDock.supportingText}
                options={diffViewerDock.options}
                selectedOptionId={diffViewerDock.selectedOptionId}
                onSelectOption={diffViewerDock.onSelectOption}
                onReturnToChat={diffViewerDock.onReturnToChat}
              />
            </div>
          </div>
        </section>

        <aside className="w-full shrink-0 lg:w-[380px]">
          <div className="overflow-hidden rounded-[1.35rem] border border-border/60 bg-card/40 shadow-[0_16px_60px_rgba(0,0,0,0.28)]">
            <div className="border-b border-border/60 px-5 py-4">
              <p className="text-sm font-semibold text-foreground">Dialkit controls</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Live-tune the stage and dock framing while you exercise the component.
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
