import { Columns2, Rows3 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

type DiffViewModeToggleProps = {
  value: "split" | "unified"
  onChange: (mode: "split" | "unified") => void
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

export function DiffViewModeToggle({ value, onChange }: DiffViewModeToggleProps) {
  return (
    <div
      className="diff-pane-header-toggle surface-segmented flex items-center gap-0.5 p-0.5"
      role="group"
      aria-label="Diff view mode"
    >
      {VIEW_MODES.map(({ value: mode, label, Icon }) => {
        const isActive = value === mode

        return (
          <Tooltip key={mode}>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="icon-sm"
                variant={isActive ? "secondary" : "ghost"}
                aria-label={label}
                aria-pressed={isActive}
                title={label}
                className="diff-pane-header-toggle-button"
                onClick={() => onChange(mode)}
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
  )
}
