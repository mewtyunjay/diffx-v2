import { Check, ChevronLeft, ChevronRight, ChevronsUpDown, Columns2, Rows3 } from "lucide-react"

import type { PreparedFileDiffResult } from "@/diffs/create"
import type { ChangedFileItem, ComparisonMode } from "@/git/types"
import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { SHORTCUTS } from "@/lib/shortcuts"
import { cn } from "@/lib/utils"

type DiffViewerToolbarProps = {
  diff: PreparedFileDiffResult | null
  comparisonMode: ComparisonMode
  selectedFile: ChangedFileItem | null
  isStagePending: boolean
  viewMode: "split" | "unified"
  isExpanded: boolean
  canGoPrev: boolean
  canGoNext: boolean
  fileIndex: number
  totalFiles: number
  onToggleExpandAll: () => void
  onToggleStage: (file: ChangedFileItem) => void
  onViewModeChange: (mode: "split" | "unified") => void
  onGoPrev: () => void
  onGoNext: () => void
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

function canExpandEntireFile(diff: PreparedFileDiffResult | null) {
  if (!diff?.parsedDiff) {
    return false
  }

  return diff.parsedDiff.hunks.some((hunk) => hunk.collapsedBefore > 0)
}

type StageState = "staged" | "unstaged" | "partial"

function getStageState(file: ChangedFileItem): StageState {
  if (file.hasStagedChanges && file.hasUnstagedChanges) {
    return "partial"
  }

  if (file.hasStagedChanges) {
    return "staged"
  }

  return "unstaged"
}

function getStageTooltipText(stageState: StageState) {
  if (stageState === "staged") {
    return "Unstage file"
  }

  if (stageState === "partial") {
    return "Toggle staged state"
  }

  return "Stage file"
}

export function DiffViewerToolbar({
  diff,
  comparisonMode,
  selectedFile,
  isStagePending,
  viewMode,
  isExpanded,
  canGoPrev,
  canGoNext,
  fileIndex,
  totalFiles,
  onToggleExpandAll,
  onToggleStage,
  onViewModeChange,
  onGoPrev,
  onGoNext,
}: DiffViewerToolbarProps) {
  const showFileNav = totalFiles > 0 && selectedFile != null
  const counterLabel = showFileNav ? `${fileIndex + 1} / ${totalFiles}` : null
  const showExpandToggle = canExpandEntireFile(diff) || isExpanded
  const expandLabel = isExpanded ? "Collapse to diff view" : "Expand full file"
  const showStageToggle = comparisonMode === "head" && selectedFile != null
  const stageState = selectedFile ? getStageState(selectedFile) : "unstaged"
  const stageTooltipText = getStageTooltipText(stageState)
  const stageIsActive = stageState !== "unstaged"
  const stageHasAction =
    selectedFile != null && (selectedFile.hasStagedChanges || selectedFile.hasUnstagedChanges)
  const stageIsDisabled = isStagePending || !stageHasAction
  const stageAriaLabel = selectedFile
    ? `${stageTooltipText}: ${selectedFile.displayPath}`
    : stageTooltipText
  const stageTooltipDescription =
    !stageHasAction && selectedFile
      ? "No stage or unstage action available for this file."
      : stageTooltipText
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/60 bg-background/94 px-4 py-2 backdrop-blur">
      <div className="flex min-w-0 items-center gap-3">
        <div
          className="surface-segmented flex items-center gap-0.5 p-0.5"
          role="group"
          aria-label="View mode"
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

        {showExpandToggle ? (
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
            </TooltipContent>
          </Tooltip>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        {showFileNav ? (
          <div
            className="flex items-center gap-0.5"
            role="group"
            aria-label="File navigation"
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Previous file"
                  disabled={!canGoPrev}
                  onClick={onGoPrev}
                >
                  <ChevronLeft className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={6}>
                Previous file
                <Kbd keys={SHORTCUTS.prevFile.keys} />
              </TooltipContent>
            </Tooltip>

            <span
              className="min-w-10 px-1 text-center type-meta tabular-nums text-muted-foreground"
              aria-live="polite"
              aria-label={`File ${fileIndex + 1} of ${totalFiles}`}
            >
              {counterLabel}
            </span>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Next file"
                  disabled={!canGoNext}
                  onClick={onGoNext}
                >
                  <ChevronRight className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={6}>
                Next file
                <Kbd keys={SHORTCUTS.nextFile.keys} />
              </TooltipContent>
            </Tooltip>
          </div>
        ) : null}

        {showStageToggle && selectedFile ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                aria-label={stageAriaLabel}
                aria-pressed={stageIsActive}
                className={cn(
                  "surface-field shrink-0 gap-1.5 px-2 shadow-none",
                  stageIsActive
                    ? "border-[var(--toggle-staged-border)] bg-[var(--toggle-staged-bg)] text-[var(--toggle-staged-text)] hover:bg-[var(--toggle-staged-bg-hover)] hover:text-[var(--toggle-staged-text)]"
                    : "text-muted-foreground hover:text-foreground"
                )}
                disabled={stageIsDisabled}
                onClick={() => onToggleStage(selectedFile)}
              >
                {stageIsActive ? <Check className="size-3" /> : null}
                <span>{stageIsActive ? "Staged" : "Stage"}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6}>
              {stageTooltipDescription}
              <Kbd keys={SHORTCUTS.toggleStage.keys} />
            </TooltipContent>
          </Tooltip>
        ) : null}
      </div>
    </div>
  )
}
