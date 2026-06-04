import { useEffect, useMemo, useRef, useState } from "react"
import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  LoaderCircle,
} from "lucide-react"

import {
  DiffFileHeaderBody,
  getDiffFileChangeCounts,
} from "@/components/diff/DiffFileHeader"
import { DiffPlaceholder } from "@/components/diff/DiffPlaceholder"
import DiffPaneRenderer from "@/components/diff/DiffPaneRenderer"
import type { SavedDiffAnnotation } from "@/diff-viewer/annotations"
import type { ChangedFileItem } from "@/git/types"
import type { PreparedFileDiffResult } from "@/diffs/create"
import type { StackedDiffState } from "@/app/diff-viewer/change-set/useStackedChangeSetDiffs"
import { cn } from "@/lib/utils"

type StackedDiffFileSectionProps = {
  expandAll: boolean
  file: ChangedFileItem
  state: StackedDiffState
  isViewed: boolean
  scopePath: string
  viewMode: "split" | "unified"
  onViewedChange: (viewed: boolean) => void
  onVisible: (file: ChangedFileItem) => void
}

const emptyAnnotations: SavedDiffAnnotation[] = []

function noop() {}

function StackedDiffBody({
  diff,
  expandAll,
  viewMode,
}: {
  diff: PreparedFileDiffResult
  expandAll: boolean
  viewMode: "split" | "unified"
}) {
  if (diff.binary) {
    return <DiffPlaceholder>Binary files are not rendered in the inline diff viewer yet.</DiffPlaceholder>
  }
  if (diff.tooLarge) {
    return <DiffPlaceholder>This file is too large for the fast inline diff path right now.</DiffPlaceholder>
  }
  if (diff.isPureRename) {
    return <DiffPlaceholder>This file was renamed without content changes.</DiffPlaceholder>
  }
  if (!diff.parsedDiff) {
    return <DiffPlaceholder>No text diff is available for this file.</DiffPlaceholder>
  }

  return (
    <DiffPaneRenderer
      diff={diff as PreparedFileDiffResult & { parsedDiff: NonNullable<PreparedFileDiffResult["parsedDiff"]> }}
      initialDraft={null}
      onDraftChange={noop}
      viewMode={viewMode}
      expandAll={expandAll}
      savedAnnotations={emptyAnnotations}
      onSaveAnnotation={noop}
      onDeleteAnnotation={noop}
      enableAnnotations={false}
      enableHunkActions={false}
      hunkActionPendingKey={null}
      onAcceptHunk={noop}
      onRejectHunk={noop}
    />
  )
}

export function StackedDiffFileSection({
  expandAll,
  file,
  state,
  isViewed,
  scopePath,
  viewMode,
  onViewedChange,
  onVisible,
}: StackedDiffFileSectionProps) {
  const sectionRef = useRef<HTMLElement | null>(null)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const diff = state.status === "loaded" ? state.diff : null
  const counts = useMemo(() => getDiffFileChangeCounts(diff), [diff])

  function handleViewedCheckboxChange(viewed: boolean) {
    onViewedChange(viewed)
    setIsCollapsed(viewed)
  }

  useEffect(() => {
    if (state.status !== "idle") {
      return
    }

    const node = sectionRef.current
    if (!node || typeof IntersectionObserver === "undefined") {
      onVisible(file)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          onVisible(file)
          observer.disconnect()
        }
      },
      { rootMargin: "900px 0px" }
    )
    observer.observe(node)

    return () => observer.disconnect()
  }, [file, onVisible, state.status])

  return (
    <section
      ref={sectionRef}
      className="border-b border-border/70 bg-background"
      aria-label={file.displayPath || file.path}
    >
      <div className="sticky top-0 z-20 border-b border-border/60 bg-background/95 px-4 py-2 backdrop-blur transition-colors">
        <DiffFileHeaderBody
          file={file}
          counts={counts}
          scopePath={scopePath}
          leadingControl={
            <button
              type="button"
              className="inline-flex size-5 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
              aria-label={isCollapsed ? "Expand file" : "Collapse file"}
              aria-expanded={!isCollapsed}
              onClick={() => setIsCollapsed((current) => !current)}
            >
              {isCollapsed ? (
                <ChevronRight className="size-3.5" />
              ) : (
                <ChevronDown className="size-3.5" />
              )}
            </button>
          }
          trailingControls={
            <label className="ml-1 inline-flex items-center gap-1.5 type-meta font-medium text-muted-foreground transition-colors hover:text-foreground">
              <input
                type="checkbox"
                className="size-3.5 rounded border-border/70 accent-primary"
                checked={isViewed}
                onChange={(event) => handleViewedCheckboxChange(event.currentTarget.checked)}
              />
              <span>Viewed</span>
            </label>
          }
        />
      </div>

      {!isCollapsed ? (
        <div className="min-h-24">
          {state.status === "idle" || state.status === "loading" ? (
            <div className="flex h-32 items-center justify-center gap-2 text-muted-foreground">
              <LoaderCircle className={cn("size-4", state.status === "loading" && "animate-spin")} />
              <span className="type-meta">Loading diff</span>
            </div>
          ) : null}

          {state.status === "error" ? (
            <div className="flex h-32 items-center justify-center gap-2 px-4 text-muted-foreground">
              <AlertCircle className="size-4" />
              <span className="type-meta">{state.error}</span>
            </div>
          ) : null}

          {state.status === "loaded" ? (
            <StackedDiffBody diff={state.diff} expandAll={expandAll} viewMode={viewMode} />
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
