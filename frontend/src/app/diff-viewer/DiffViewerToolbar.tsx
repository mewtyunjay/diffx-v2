import { Columns2, Rows3 } from "lucide-react"

import type { PreparedFileDiffResult } from "@/components/diff/prepareDiff"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

type DiffViewerToolbarProps = {
  path: string
  diff: PreparedFileDiffResult | null
  viewMode: "split" | "unified"
  onViewModeChange: (mode: "split" | "unified") => void
}

const VIEW_MODES = [
  {
    value: "split" as const,
    label: "Split view",
    Icon: Columns2,
  },
  {
    value: "unified" as const,
    label: "Unified view",
    Icon: Rows3,
  },
]

function getChangeCounts(diff: PreparedFileDiffResult | null) {
  if (!diff?.parsedDiff) {
    return null
  }

  let additions = 0
  let deletions = 0

  for (const hunk of diff.parsedDiff.hunks) {
    additions += hunk.additionLines
    deletions += hunk.deletionLines
  }

  return { additions, deletions }
}

export function DiffViewerToolbar({
  path,
  diff,
  viewMode,
  onViewModeChange,
}: DiffViewerToolbarProps) {
  const counts = getChangeCounts(diff)

  return (
    <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border/60 bg-background/92 px-4 py-2 backdrop-blur">
      <div className="min-w-0 flex-1">
        <p className="truncate type-meta font-medium text-foreground" title={path}>
          {path}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        {counts ? (
          <div className="flex items-center gap-2 whitespace-nowrap type-meta type-data font-medium">
            <span className="diff-toolbar-deletions">{`-${counts.deletions}`}</span>
            <span className="diff-toolbar-additions">{`+${counts.additions}`}</span>
          </div>
        ) : null}

        <div
          className="surface-segmented flex items-center gap-0.5 p-0.5"
          role="group"
          aria-label="Diff view mode"
        >
          {VIEW_MODES.map(({ value, label, Icon }) => {
            const isActive = viewMode === value

            return (
              <Tooltip key={value}>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant={isActive ? "secondary" : "ghost"}
                    aria-label={label}
                    aria-pressed={isActive}
                    title={label}
                    onClick={() => onViewModeChange(value)}
                  >
                    <Icon className="size-3.5" />
                    <span className="sr-only">{label}</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={6}>
                  {label}
                </TooltipContent>
              </Tooltip>
            )
          })}
        </div>
      </div>
    </div>
  )
}
