import { ChevronsUpDown, Columns2, Rows3 } from "lucide-react"

import type { PreparedFileDiffResult } from "@/components/diff/prepareDiff"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

type DiffViewerToolbarProps = {
  path: string
  diff: PreparedFileDiffResult | null
  viewMode: "split" | "unified"
  isExpanded: boolean
  onExpandAll: () => void
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

function getTrailingHiddenLineCount(diff: PreparedFileDiffResult["parsedDiff"]) {
  if (!diff?.hunks.length) {
    return 0
  }

  const lastHunk = diff.hunks.at(-1)
  if (!lastHunk) {
    return 0
  }

  return Math.max(
    (diff.newLines?.length ?? 0) - Math.max(lastHunk.additionStart + lastHunk.additionCount - 1, 0),
    0
  )
}

function canExpandEntireFile(diff: PreparedFileDiffResult | null) {
  if (!diff?.parsedDiff?.oldLines?.length || !diff.parsedDiff.newLines?.length) {
    return false
  }

  return (
    diff.parsedDiff.hunks.some((hunk) => hunk.collapsedBefore > 0) ||
    getTrailingHiddenLineCount(diff.parsedDiff) > 0
  )
}

export function DiffViewerToolbar({
  path,
  diff,
  viewMode,
  isExpanded,
  onExpandAll,
  onViewModeChange,
}: DiffViewerToolbarProps) {
  const counts = getChangeCounts(diff)
  const showExpandAll = canExpandEntireFile(diff)

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
          aria-label="Diff viewer controls"
        >
          {showExpandAll ? (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant={isExpanded ? "secondary" : "ghost"}
                    aria-label={isExpanded ? "File fully expanded" : "Expand full file"}
                    title={isExpanded ? "File fully expanded" : "Expand full file"}
                    disabled={isExpanded}
                    onClick={onExpandAll}
                  >
                    <ChevronsUpDown className="size-3.5" />
                    <span className="sr-only">
                      {isExpanded ? "File fully expanded" : "Expand full file"}
                    </span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={6}>
                  {isExpanded ? "File fully expanded" : "Expand full file"}
                </TooltipContent>
              </Tooltip>

              <div className="h-4 w-px bg-border/70" aria-hidden="true" />
            </>
          ) : null}

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
