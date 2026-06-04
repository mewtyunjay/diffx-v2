import type { LucideIcon } from "lucide-react"
import {
  AlertCircle,
  ChevronsUpDown,
  Columns2,
  GitPullRequest,
  LoaderCircle,
  Rows3,
} from "lucide-react"

import { StackedChangeSetDiffs } from "@/app/diff-viewer/change-set/StackedChangeSetDiffs"
import type { DiffDetailMode, DiffViewMode } from "@/app/diff-viewer/preferences"
import type { ChangeSetDetail, ChangeSetFileDiffLoader } from "@/app/diff-viewer/change-set/types"
import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { SHORTCUTS } from "@/lib/shortcuts"

type ChangeSetDetailPaneProps = {
  detail: ChangeSetDetail | null
  detailMode: DiffDetailMode
  error: string | null
  isLoading: boolean
  loadFileDiff: ChangeSetFileDiffLoader
  placeholderTitle: string
  placeholderDescription: string
  PlaceholderIcon?: LucideIcon
  scopePath: string
  sourceKey: string
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

function ChangeSetLoadingState() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-border/70 px-5 py-4">
        <div className="h-4 w-48 rounded-sm bg-muted" />
        <div className="mt-3 flex gap-2">
          <div className="h-5 w-16 rounded-sm bg-muted/70" />
          <div className="h-5 w-24 rounded-sm bg-muted/70" />
          <div className="h-5 w-20 rounded-sm bg-muted/70" />
        </div>
      </div>
      <div className="flex flex-1 items-center justify-center gap-2 text-muted-foreground">
        <LoaderCircle className="size-4 animate-spin" />
        <span className="type-meta">Loading change set</span>
      </div>
    </div>
  )
}

function ChangeSetMessage({
  Icon,
  title,
  description,
}: {
  Icon: LucideIcon
  title: string
  description: string
}) {
  return (
    <div className="flex h-full min-h-0 items-center justify-center px-6">
      <div className="flex max-w-sm flex-col items-center text-center">
        <Icon className="mb-3 size-6 text-muted-foreground/70" />
        <h2 className="type-body font-medium text-foreground">{title}</h2>
        <p className="mt-1 type-meta leading-5 text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

function ChangeSetReviewOptions({
  detailMode,
  viewMode,
  onToggleExpandAll,
  onViewModeChange,
}: {
  detailMode: DiffDetailMode
  viewMode: DiffViewMode
  onToggleExpandAll: () => void
  onViewModeChange: (mode: DiffViewMode) => void
}) {
  const isExpanded = detailMode === "fullFile"
  const expandLabel = isExpanded ? "Collapse to diff view" : "Expand full file"

  return (
    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
      <div
        className="surface-segmented flex items-center gap-0.5 p-0.5"
        role="group"
        aria-label="Change-set diff layout"
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

export function ChangeSetDetailPane({
  detail,
  detailMode,
  error,
  isLoading,
  loadFileDiff,
  placeholderTitle,
  placeholderDescription,
  PlaceholderIcon = GitPullRequest,
  scopePath,
  sourceKey,
  viewMode,
  onToggleExpandAll,
  onViewModeChange,
}: ChangeSetDetailPaneProps) {
  if (isLoading) {
    return <ChangeSetLoadingState />
  }

  if (error) {
    return (
      <ChangeSetMessage
        Icon={AlertCircle}
        title="Unable to load change set"
        description={error}
      />
    )
  }

  if (!detail) {
    return (
      <ChangeSetMessage
        Icon={PlaceholderIcon}
        title={placeholderTitle}
        description={placeholderDescription}
      />
    )
  }

  const Icon = detail.icon

  return (
    <div className="no-scrollbar flex h-full min-h-0 flex-col overflow-y-auto overscroll-none bg-background">
      <header className="border-b border-border/70 px-5 py-4">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border border-border/70 bg-muted/40">
              <Icon className="size-4 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="truncate type-body font-semibold text-foreground">{detail.title}</h1>
              {detail.subtitle ? (
                <p className="mt-1 truncate type-mono-meta text-muted-foreground">{detail.subtitle}</p>
              ) : null}
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {detail.meta.map((item) => (
                  <span
                    key={`${item.label}:${item.value}`}
                    className="inline-flex h-6 items-center gap-1 rounded-sm border border-border/70 bg-muted/40 px-2 type-meta text-muted-foreground"
                  >
                    <span className="text-muted-foreground/70">{item.label}</span>
                    <span className="font-medium text-foreground/82">{item.value}</span>
                  </span>
                ))}
                <span className="inline-flex h-6 items-center rounded-sm border border-border/70 bg-muted/40 px-2 type-meta font-medium text-foreground/82">
                  {detail.files.length} changed {detail.files.length === 1 ? "file" : "files"}
                </span>
              </div>
            </div>
          </div>
          <ChangeSetReviewOptions
            detailMode={detailMode}
            viewMode={viewMode}
            onToggleExpandAll={onToggleExpandAll}
            onViewModeChange={onViewModeChange}
          />
        </div>
      </header>

      <StackedChangeSetDiffs
        expandAll={detailMode === "fullFile"}
        files={detail.files}
        loadFileDiff={loadFileDiff}
        scopePath={scopePath}
        sourceKey={sourceKey}
        viewMode={viewMode}
      />
    </div>
  )
}
