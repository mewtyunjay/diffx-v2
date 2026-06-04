import type { LucideIcon } from "lucide-react"
import {
  AlertCircle,
  CalendarClock,
  Copy,
  GitCommitHorizontal,
  LoaderCircle,
  UserRound,
} from "lucide-react"

import { CommitReviewOptions } from "@/app/diff-viewer/change-set/CommitReviewOptions"
import { StackedChangeSetDiffs } from "@/app/diff-viewer/change-set/StackedChangeSetDiffs"
import type { DiffDetailMode, DiffViewMode } from "@/app/diff-viewer/preferences"
import type { ChangeSetFileDiffLoader } from "@/app/diff-viewer/change-set/types"
import type { CommitDetailResult } from "@/git/types"
import { toast } from "@/components/ui/sonner"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

type CommitDetailPaneProps = {
  detail: CommitDetailResult | null
  detailMode: DiffDetailMode
  error: string | null
  isLoading: boolean
  loadFileDiff: ChangeSetFileDiffLoader
  scopePath: string
  sourceKey: string
  viewMode: DiffViewMode
  onToggleExpandAll: () => void
  onViewModeChange: (mode: DiffViewMode) => void
}

type CommitFactProps = {
  Icon: LucideIcon
  label: string
  value: string
  isMono?: boolean
}

const commitDateFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
})

function formatCommitDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ""
  }

  return commitDateFormatter.format(date)
}

async function copyFullCommitHash(fullHash: string, shortHash: string) {
  try {
    await navigator.clipboard.writeText(fullHash)
    toast.success(`Copied ${shortHash}.`)
  } catch {
    toast.error("Couldn’t copy commit hash.")
  }
}

function CommitPaneLoadingState() {
  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="border-b border-border/70 px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="size-9 rounded-md bg-muted" />
          <div className="min-w-0 flex-1">
            <div className="h-4 w-28 rounded-sm bg-muted/70" />
            <div className="mt-3 h-6 w-96 max-w-full rounded-sm bg-muted" />
            <div className="mt-3 grid grid-cols-4 gap-2">
              <div className="h-11 rounded-md bg-muted/55" />
              <div className="h-11 rounded-md bg-muted/55" />
              <div className="h-11 rounded-md bg-muted/55" />
              <div className="h-11 rounded-md bg-muted/55" />
            </div>
          </div>
        </div>
      </div>
      <div className="flex flex-1 items-center justify-center gap-2 text-muted-foreground">
        <LoaderCircle className="size-4 animate-spin" />
        <span className="type-meta">Loading commit</span>
      </div>
    </div>
  )
}

function CommitPaneMessage({
  Icon,
  title,
  description,
}: {
  Icon: LucideIcon
  title: string
  description: string
}) {
  return (
    <div className="flex h-full min-h-0 items-center justify-center bg-background px-6">
      <div className="flex max-w-sm flex-col items-center text-center">
        <Icon className="mb-3 size-6 text-muted-foreground/70" />
        <h2 className="type-body font-medium text-foreground">{title}</h2>
        <p className="mt-1 type-meta leading-5 text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

function CommitFact({ Icon, label, value, isMono = false }: CommitFactProps) {
  return (
    <div className="min-w-0 rounded-md border border-border/65 bg-muted/28 px-3 py-2">
      <div className="mb-1 flex items-center gap-1.5 text-muted-foreground/70">
        <Icon className="size-3.5" />
        <span className="type-section-label">{label}</span>
      </div>
      <p
        className={
          isMono
            ? "truncate type-mono-meta font-medium text-foreground"
            : "truncate type-meta font-medium text-foreground"
        }
        title={value}
      >
        {value}
      </p>
    </div>
  )
}

function CopyableCommitShortHash({
  fullHash,
  shortHash,
}: {
  fullHash: string
  shortHash: string
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex h-6 translate-y-[-0.0625rem] items-center gap-1.5 rounded-sm border border-border/70 bg-muted/35 px-2 align-baseline type-mono-meta font-medium text-muted-foreground transition-colors hover:border-primary/35 hover:bg-[var(--accent-soft)] hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          aria-label={`Copy full commit hash ${fullHash}`}
          onClick={() => void copyFullCommitHash(fullHash, shortHash)}
        >
          {shortHash}
          <Copy className="size-3" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6}>
        Copy full commit hash
      </TooltipContent>
    </Tooltip>
  )
}

export function CommitDetailPane({
  detail,
  detailMode,
  error,
  isLoading,
  loadFileDiff,
  scopePath,
  sourceKey,
  viewMode,
  onToggleExpandAll,
  onViewModeChange,
}: CommitDetailPaneProps) {
  if (isLoading) {
    return <CommitPaneLoadingState />
  }

  if (error) {
    return (
      <CommitPaneMessage
        Icon={AlertCircle}
        title="Unable to load commit"
        description={error}
      />
    )
  }

  if (!detail) {
    return (
      <CommitPaneMessage
        Icon={GitCommitHorizontal}
        title="Select a commit"
        description="Choose a commit from the sidebar to review its changed files."
      />
    )
  }

  const formattedDate = formatCommitDate(detail.commit.authorDate)
  const fileCountLabel = `${detail.files.length} changed ${
    detail.files.length === 1 ? "file" : "files"
  }`

  return (
    <div className="no-scrollbar flex h-full min-h-0 flex-col overflow-y-auto overscroll-none bg-background">
      <header className="border-b border-border/70 bg-background px-5 py-4">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-md border border-primary/30 bg-[var(--accent-soft)] text-primary">
              <GitCommitHorizontal className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1 type-title text-foreground">
                <span className="min-w-0 text-balance">
                  {detail.commit.subject || "(no subject)"}
                </span>
                <CopyableCommitShortHash
                  fullHash={detail.commit.hash}
                  shortHash={detail.commit.shortHash}
                />
              </h1>
            </div>
          </div>
          <CommitReviewOptions
            detailMode={detailMode}
            viewMode={viewMode}
            onToggleExpandAll={onToggleExpandAll}
            onViewModeChange={onViewModeChange}
          />
        </div>

        <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] gap-2">
          <CommitFact Icon={UserRound} label="Author" value={detail.commit.authorName || "Unknown"} />
          <CommitFact Icon={CalendarClock} label="Date" value={formattedDate || "Unknown"} />
          <CommitFact Icon={GitCommitHorizontal} label="Files" value={fileCountLabel} />
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
