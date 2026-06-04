import { GitPullRequest } from "lucide-react"

import type { PullRequestListItem as PullRequestListItemType } from "@/git/types"
import { cn } from "@/lib/utils"

type PullRequestListItemProps = {
  pr: PullRequestListItemType
  isActive: boolean
  onSelectPullRequest: (pr: PullRequestListItemType) => void
}

const compactDateFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
})

function formatUpdatedDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ""
  }

  return compactDateFormatter.format(date)
}

function statusLabel(pr: PullRequestListItemType) {
  if (pr.isDraft) {
    return "Draft"
  }
  if (pr.reviewDecision === "APPROVED") {
    return "Approved"
  }
  if (pr.reviewDecision === "CHANGES_REQUESTED") {
    return "Changes"
  }
  if (pr.reviewDecision === "REVIEW_REQUIRED") {
    return "Review"
  }
  if (pr.checkConclusion === "success") {
    return "Checks"
  }
  if (pr.checkConclusion === "failure") {
    return "Failing"
  }
  if (pr.checkConclusion === "pending") {
    return "Pending"
  }

  return "Open"
}

function statusClassName(pr: PullRequestListItemType) {
  if (pr.isDraft) {
    return "border-sidebar-border bg-sidebar-accent/55 text-sidebar-foreground/62"
  }
  if (pr.reviewDecision === "APPROVED" || pr.checkConclusion === "success") {
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
  }
  if (pr.reviewDecision === "CHANGES_REQUESTED" || pr.checkConclusion === "failure") {
    return "border-rose-500/25 bg-rose-500/10 text-rose-300"
  }
  if (pr.reviewDecision === "REVIEW_REQUIRED" || pr.checkConclusion === "pending") {
    return "border-amber-500/25 bg-amber-500/10 text-amber-300"
  }

  return "border-sidebar-border bg-sidebar-accent/45 text-sidebar-foreground/72"
}

export function PullRequestListItem({
  pr,
  isActive,
  onSelectPullRequest,
}: PullRequestListItemProps) {
  const formattedDate = formatUpdatedDate(pr.updatedAt)
  const fileCountLabel =
    pr.changedFilesCount == null
      ? null
      : `${pr.changedFilesCount} ${pr.changedFilesCount === 1 ? "file" : "files"}`
  const branchLabel = `${pr.headRefName} -> ${pr.baseRefName}`

  return (
    <button
      type="button"
      aria-current={isActive ? "true" : undefined}
      className={cn(
        "flex w-full min-w-0 flex-col rounded-md px-1.5 py-2 text-left transition-colors hover:bg-[var(--surface-sidebar-hover)] focus-visible:ring-2 focus-visible:ring-sidebar-ring/60 focus-visible:outline-none",
        isActive &&
          "bg-[var(--surface-selected)] text-sidebar-foreground hover:bg-[var(--surface-selected)]"
      )}
      onClick={() => onSelectPullRequest(pr)}
    >
      <span className="flex min-w-0 items-start gap-2">
        <GitPullRequest
          className={cn(
            "mt-0.5 size-3.5 shrink-0 text-sidebar-primary/70",
            isActive && "text-sidebar-primary"
          )}
        />
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "block truncate type-meta font-medium text-sidebar-foreground/88",
              isActive && "text-sidebar-foreground"
            )}
            title={pr.title}
          >
            {pr.title}
          </span>
          <span className="mt-1 flex min-w-0 items-center gap-1.5 type-mono-meta text-sidebar-foreground/45">
            <span className="shrink-0 text-sidebar-primary/70">#{pr.number}</span>
            <span className="truncate" title={branchLabel}>
              {branchLabel}
            </span>
          </span>
        </span>
        {formattedDate ? (
          <span className="shrink-0 pt-0.5 type-mono-meta text-sidebar-foreground/38">
            {formattedDate}
          </span>
        ) : null}
      </span>

      <span className="mt-2 flex min-w-0 flex-wrap items-center gap-1">
        <span
          className={cn(
            "inline-flex h-5 max-w-full items-center rounded-sm border px-1.5 type-meta font-medium",
            statusClassName(pr)
          )}
        >
          {statusLabel(pr)}
        </span>
        {fileCountLabel ? (
          <span className="inline-flex h-5 max-w-full items-center rounded-sm border border-sidebar-border bg-sidebar-accent/35 px-1.5 type-meta text-sidebar-foreground/62">
            {fileCountLabel}
          </span>
        ) : null}
        {pr.labels.slice(0, 2).map((label) => (
          <span
            key={label}
            className="inline-flex h-5 max-w-24 items-center truncate rounded-sm border border-sidebar-border bg-sidebar-accent/35 px-1.5 type-meta text-sidebar-foreground/62"
            title={label}
          >
            {label}
          </span>
        ))}
      </span>
    </button>
  )
}
