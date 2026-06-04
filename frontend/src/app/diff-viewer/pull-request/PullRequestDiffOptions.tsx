import { ChevronsUpDown, Columns2, Rows3 } from "lucide-react"

import type { DiffDetailMode, DiffViewMode } from "@/app/diff-viewer/preferences"
import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { SHORTCUTS } from "@/lib/shortcuts"

type PullRequestDiffOptionsProps = {
  detailMode: DiffDetailMode
  viewMode: DiffViewMode
  onToggleExpandAll: () => void
  onViewModeChange: (mode: DiffViewMode) => void
}

const VIEW_MODE_OPTIONS = [
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

export function PullRequestDiffOptions({
  detailMode,
  viewMode,
  onToggleExpandAll,
  onViewModeChange,
}: PullRequestDiffOptionsProps) {
  const isExpanded = detailMode === "fullFile"
  const expandLabel = isExpanded ? "Collapse to diff view" : "Expand full file"

  return (
    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
      <div
        className="surface-segmented flex items-center gap-0.5 p-0.5"
        role="group"
        aria-label="Pull request diff layout"
      >
        {VIEW_MODE_OPTIONS.map(({ value, label, Icon }) => {
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
                  onClick={() => onViewModeChange(value)}
                >
                  <Icon className="size-3.5" />
                  <span className="sr-only">{label}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={6}>
                {label}
                <Kbd keys={SHORTCUTS.toggleViewMode.keys} />
              </TooltipContent>
            </Tooltip>
          )
        })}
      </div>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            size="icon-sm"
            variant={isExpanded ? "secondary" : "ghost"}
            className="surface-segmented p-0.5"
            aria-label={expandLabel}
            aria-pressed={isExpanded}
            onClick={onToggleExpandAll}
          >
            <ChevronsUpDown className="size-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={6}>
          {expandLabel}
          <Kbd keys={SHORTCUTS.toggleExpandFile.keys} />
        </TooltipContent>
      </Tooltip>
    </div>
  )
}
