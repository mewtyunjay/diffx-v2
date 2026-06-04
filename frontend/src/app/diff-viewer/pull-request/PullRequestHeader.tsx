import { GitBranch, GitPullRequest } from "lucide-react"

import type { DiffDetailMode, DiffViewMode } from "@/app/diff-viewer/preferences"
import { PullRequestActions } from "@/app/diff-viewer/pull-request/PullRequestActions"
import { PullRequestChecksSummary } from "@/app/diff-viewer/pull-request/PullRequestChecksSummary"
import { PullRequestDiffOptions } from "@/app/diff-viewer/pull-request/PullRequestDiffOptions"
import { PullRequestReviewsSummary } from "@/app/diff-viewer/pull-request/PullRequestReviewsSummary"
import type { MergeMethod, PullRequestDetailResult } from "@/git/types"
import { cn } from "@/lib/utils"

type PullRequestHeaderProps = {
  detail: PullRequestDetailResult
  detailMode: DiffDetailMode
  isApprovePending: boolean
  isMergePending: boolean
  isRefreshPending: boolean
  viewMode: DiffViewMode
  onApprove: (body?: string) => Promise<void>
  onMerge: (method?: MergeMethod) => Promise<void>
  onRefresh: () => void
  onToggleExpandAll: () => void
  onViewModeChange: (mode: DiffViewMode) => void
}

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
})

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ""
  }

  return dateFormatter.format(date)
}

function stateLabel(detail: PullRequestDetailResult) {
  if (detail.pr.isDraft) {
    return "Draft"
  }
  if (detail.pr.state === "MERGED") {
    return "Merged"
  }
  if (detail.pr.state === "CLOSED") {
    return "Closed"
  }

  return "Open"
}

function stateClassName(detail: PullRequestDetailResult) {
  if (detail.pr.isDraft) {
    return "border-border bg-muted/45 text-muted-foreground"
  }
  if (detail.pr.state === "MERGED") {
    return "border-purple-500/25 bg-purple-500/10 text-purple-200"
  }
  if (detail.pr.state === "CLOSED") {
    return "border-rose-500/25 bg-rose-500/10 text-rose-300"
  }

  return "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
}

export function PullRequestHeader({
  detail,
  detailMode,
  isApprovePending,
  isMergePending,
  isRefreshPending,
  viewMode,
  onApprove,
  onMerge,
  onRefresh,
  onToggleExpandAll,
  onViewModeChange,
}: PullRequestHeaderProps) {
  const updatedDate = formatDate(detail.pr.updatedAt)
  const createdDate = formatDate(detail.pr.createdAt)
  const commitCount = detail.pr.commitsCount ?? detail.commits.length
  const changedFilesCount = detail.pr.changedFilesCount ?? detail.files.length
  const forkLabel =
    detail.head.repositoryOwner && detail.head.repositoryName
      ? `${detail.head.repositoryOwner}/${detail.head.repositoryName}:`
      : ""
  const headLabel = `${forkLabel}${detail.head.refName}`
  const metaParts = [
    detail.pr.author ? `${detail.pr.author} wants to merge` : "Pull request wants to merge",
    `${commitCount} ${commitCount === 1 ? "commit" : "commits"}`,
    `${changedFilesCount} ${changedFilesCount === 1 ? "file" : "files"}`,
    updatedDate ? `updated ${updatedDate}` : createdDate ? `opened ${createdDate}` : "",
  ].filter(Boolean)

  return (
    <header className="border-b border-border/70 bg-background px-5 py-4">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md border border-primary/30 bg-[var(--accent-soft)] text-primary">
            <GitPullRequest className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1 type-title text-foreground">
              <span className="min-w-0 text-balance">{detail.pr.title}</span>
              <span className="shrink-0 type-mono-meta text-muted-foreground">
                #{detail.pr.number}
              </span>
              <span
                className={cn(
                  "inline-flex h-6 shrink-0 items-center rounded-sm border px-2 type-meta font-medium",
                  stateClassName(detail)
                )}
              >
                {stateLabel(detail)}
              </span>
            </h1>

            <p className="mt-2 type-meta leading-5 text-muted-foreground">
              {metaParts.join(" · ")}
            </p>

            <div className="mt-3 flex min-w-0 flex-wrap items-center gap-2">
              <span className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-md border border-border/70 bg-muted/30 px-2 py-1 type-mono-meta text-muted-foreground">
                <GitBranch className="size-3.5 shrink-0" />
                <span className="min-w-0 truncate" title={headLabel}>
                  {headLabel}
                </span>
                <span className="shrink-0 text-muted-foreground/50">-&gt;</span>
                <span className="min-w-0 truncate text-foreground/82" title={detail.base.refName}>
                  {detail.base.refName}
                </span>
              </span>
              {detail.outsideScopeCount ? (
                <span className="inline-flex h-6 items-center rounded-sm border border-amber-500/25 bg-amber-500/10 px-2 type-meta text-amber-200">
                  {detail.outsideScopeCount} outside scope
                </span>
              ) : null}
              {detail.merge.blockedReason ? (
                <span className="inline-flex h-6 max-w-full items-center truncate rounded-sm border border-amber-500/25 bg-amber-500/10 px-2 type-meta text-amber-200">
                  {detail.merge.blockedReason}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <PullRequestActions
          detail={detail}
          isApprovePending={isApprovePending}
          isMergePending={isMergePending}
          isRefreshPending={isRefreshPending}
          onApprove={onApprove}
          onMerge={onMerge}
          onRefresh={onRefresh}
        />
      </div>

      <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(12rem,1fr))] gap-2">
        <PullRequestChecksSummary checks={detail.checks} />
        <PullRequestReviewsSummary reviews={detail.reviews} />
      </div>

      <div className="mt-3 flex justify-end">
        <PullRequestDiffOptions
          detailMode={detailMode}
          viewMode={viewMode}
          onToggleExpandAll={onToggleExpandAll}
          onViewModeChange={onViewModeChange}
        />
      </div>
    </header>
  )
}
