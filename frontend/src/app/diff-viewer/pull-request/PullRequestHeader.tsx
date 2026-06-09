import { Copy, GitPullRequest } from "lucide-react"

import { PullRequestActions } from "@/app/diff-viewer/pull-request/PullRequestActions"
import { toast } from "@/components/ui/sonner"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { MergeMethod, PullRequestDetailResult } from "@/git/types"
import { cn } from "@/lib/utils"

type PullRequestHeaderProps = {
  detail: PullRequestDetailResult
  isApprovePending: boolean
  isMergePending: boolean
  isRefreshPending: boolean
  onApprove: (body?: string) => Promise<void>
  onMerge: (method?: MergeMethod) => Promise<void>
  onRefresh: () => void
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

async function copyBranchName(branchName: string) {
  try {
    await navigator.clipboard.writeText(branchName)
    toast.success(`Copied ${branchName}.`)
  } catch {
    toast.error("Couldn’t copy branch name.")
  }
}

function BranchBadge({
  children,
  branchName,
  className,
  copyLabel,
}: {
  children: string
  branchName?: string
  className?: string
  copyLabel?: string
}) {
  const badgeClassName =
    "inline-flex h-6 max-w-full items-center gap-1.5 rounded-sm border border-border/70 bg-muted/35 px-2 align-baseline type-mono-meta font-medium text-foreground/86"

  if (!branchName) {
    return (
      <span className={cn(badgeClassName, className)} title={children}>
        <span className="min-w-0 truncate">{children}</span>
      </span>
    )
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            badgeClassName,
            "transition-colors hover:border-primary/35 hover:bg-[var(--accent-soft)] hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
            className
          )}
          aria-label={copyLabel ?? `Copy branch name ${branchName}`}
          onClick={() => void copyBranchName(branchName)}
        >
          <span className="min-w-0 truncate">{children}</span>
          <Copy className="size-3 shrink-0" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6}>
        {copyLabel ?? "Copy branch name"}
      </TooltipContent>
    </Tooltip>
  )
}

export function PullRequestHeader({
  detail,
  isApprovePending,
  isMergePending,
  isRefreshPending,
  onApprove,
  onMerge,
  onRefresh,
}: PullRequestHeaderProps) {
  const updatedDate = formatDate(detail.pr.updatedAt)
  const createdDate = formatDate(detail.pr.createdAt)
  const commitCount = detail.pr.commitsCount ?? detail.commits.length
  const changedFilesCount = detail.pr.changedFilesCount ?? detail.files.length
  const metaParts = [
    `${changedFilesCount} ${changedFilesCount === 1 ? "file" : "files"}`,
    updatedDate ? `updated ${updatedDate}` : createdDate ? `opened ${createdDate}` : "",
  ].filter(Boolean)
  const authorLabel = detail.pr.author || "Someone"
  const commitsLabel = `${commitCount} ${commitCount === 1 ? "commit" : "commits"}`

  return (
    <header className="border-b border-border/70 bg-background px-5 py-4">
      <div className="flex min-w-0 items-start gap-3">
        <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md border border-primary/30 bg-[var(--accent-soft)] text-primary">
          <GitPullRequest className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
            <h1 className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-1 type-title text-foreground">
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

          <div className="mt-2 flex min-w-0 max-w-full items-center gap-x-1.5 overflow-hidden whitespace-nowrap type-meta leading-6 text-muted-foreground">
            <span className="shrink-0">
              <span className="font-medium text-foreground/88">{authorLabel}</span> wants to merge{" "}
              {commitsLabel} into
            </span>
            <BranchBadge className="shrink-0">{detail.base.refName}</BranchBadge>
            <span className="shrink-0">from</span>
            <BranchBadge
              branchName={detail.head.refName}
              className="min-w-0 max-w-[min(34rem,100%)] shrink"
              copyLabel="Copy source branch name"
            >
              {detail.head.refName}
            </BranchBadge>
          </div>

          {metaParts.length > 0 ? (
            <p className="mt-2 type-meta leading-6 text-muted-foreground/72">
              {metaParts.join(" · ")}
            </p>
          ) : null}

          <div className="mt-3 flex min-w-0 flex-wrap items-center gap-2">
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
    </header>
  )
}
