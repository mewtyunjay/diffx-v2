import {
  AlertCircle,
  CheckCircle2,
  GitBranch,
  LoaderCircle,
  RefreshCw,
} from "lucide-react"

import { PullRequestListItem as PullRequestListRow } from "@/app/diff-viewer/pull-request/PullRequestListItem"
import type {
  GitHubIntegrationState,
  GitHubRepository,
  PullRequestFilter,
  PullRequestListItem,
} from "@/git/types"
import { SidebarPanelStickyHeader } from "@/components/sidebar/SidebarPanelStickyHeader"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

type PullRequestListPanelProps = {
  repo: GitHubRepository | null
  prs: PullRequestListItem[]
  state: GitHubIntegrationState | null
  error: string | null
  filter: PullRequestFilter
  isLoading: boolean
  selectedNumber: number | null
  onFilterChange: (filter: PullRequestFilter) => void
  onRefresh: () => void
  onSelectPullRequest: (pr: PullRequestListItem) => void
}

function PullRequestListSkeleton() {
  return (
    <div className="space-y-1 px-1 pt-1">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="rounded-md px-1.5 py-2">
          <div className="h-3.5 w-11/12 rounded-sm bg-sidebar-accent" />
          <div className="mt-2 flex gap-1.5">
            <div className="h-4 w-12 rounded-sm bg-sidebar-accent/70" />
            <div className="h-4 w-16 rounded-sm bg-sidebar-accent/70" />
            <div className="h-4 w-10 rounded-sm bg-sidebar-accent/70" />
          </div>
        </div>
      ))}
    </div>
  )
}

function PullRequestListMessage({
  Icon,
  title,
  description,
}: {
  Icon: typeof AlertCircle
  title: string
  description?: string
}) {
  return (
    <div className="flex min-h-36 items-center justify-center px-4 py-8">
      <div className="flex max-w-56 flex-col items-center text-center">
        <Icon className="mb-2 size-5 text-sidebar-foreground/42" />
        <p className="type-meta font-medium text-sidebar-foreground/78">{title}</p>
        {description ? (
          <p className="mt-1 type-meta leading-5 text-sidebar-foreground/48">{description}</p>
        ) : null}
      </div>
    </div>
  )
}

export function PullRequestListPanel({
  repo,
  prs,
  state,
  error,
  filter,
  isLoading,
  selectedNumber,
  onFilterChange,
  onRefresh,
  onSelectPullRequest,
}: PullRequestListPanelProps) {
  const repoLabel = repo?.owner && repo?.name ? `${repo.owner}/${repo.name}` : "GitHub"
  const hasIntegrationError = state != null && state.status !== "ok"

  return (
    <div className="flex min-h-0 flex-col">
      <SidebarPanelStickyHeader showDivider>
        <div className="flex items-center justify-between gap-2 px-1">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2 text-sidebar-foreground/72">
              <GitBranch className="size-3.5 shrink-0 text-sidebar-foreground/45" />
              <p className="min-w-0 truncate type-meta font-medium">
                {prs.length} {filter} {prs.length === 1 ? "PR" : "PRs"}
              </p>
            </div>
            <p className="mt-0.5 truncate type-mono-meta text-sidebar-foreground/38">
              {repoLabel}
            </p>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                aria-label="Refresh pull requests"
                onClick={onRefresh}
              >
                {isLoading ? (
                  <LoaderCircle className="size-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="size-3.5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6}>
              Refresh pull requests
            </TooltipContent>
          </Tooltip>
        </div>
        <div className="surface-segmented mt-2 flex gap-0.5 p-0.5" role="group" aria-label="Pull request state">
          {(["open", "closed"] as const).map((option) => (
            <Button
              key={option}
              type="button"
              size="xs"
              variant={filter === option ? "secondary" : "ghost"}
              className="flex-1"
              aria-pressed={filter === option}
              onClick={() => onFilterChange(option)}
            >
              {option === "open" ? "Open" : "Closed"}
            </Button>
          ))}
        </div>
      </SidebarPanelStickyHeader>

      {isLoading && prs.length === 0 ? <PullRequestListSkeleton /> : null}

      {error && prs.length === 0 ? (
        <PullRequestListMessage Icon={AlertCircle} title="Unable to load PRs" description={error} />
      ) : null}

      {hasIntegrationError && prs.length === 0 ? (
        <PullRequestListMessage
          Icon={AlertCircle}
          title={state.message}
          description={state.action}
        />
      ) : null}

      {!isLoading && !error && !hasIntegrationError && prs.length === 0 ? (
        <PullRequestListMessage
          Icon={CheckCircle2}
          title={`No ${filter} pull requests`}
        />
      ) : null}

      {prs.length > 0 ? (
        <ol className="space-y-0.5">
          {prs.map((pr) => (
            <li key={pr.number}>
              <PullRequestListRow
                pr={pr}
                isActive={selectedNumber === pr.number}
                onSelectPullRequest={onSelectPullRequest}
              />
            </li>
          ))}
        </ol>
      ) : null}

      {isLoading && prs.length > 0 ? (
        <div className="mt-2 flex items-center justify-center gap-2 border-t border-sidebar-border/50 pt-2 text-sidebar-foreground/45">
          <LoaderCircle className="size-3.5 animate-spin" />
          <p className="type-meta">Refreshing PRs</p>
        </div>
      ) : null}

    </div>
  )
}
