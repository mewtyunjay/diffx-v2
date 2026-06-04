import { AlertCircle, GitCommitHorizontal, GitPullRequest, LoaderCircle } from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

import { StackedChangeSetDiffs } from "@/app/diff-viewer/change-set/StackedChangeSetDiffs"
import type { ChangeSetFileDiffLoader } from "@/app/diff-viewer/change-set/types"
import type { DiffDetailMode, DiffViewMode } from "@/app/diff-viewer/preferences"
import { PullRequestHeader } from "@/app/diff-viewer/pull-request/PullRequestHeader"
import type { MergeMethod, PullRequestDetailResult } from "@/git/types"

type PullRequestDetailPaneProps = {
  selectedNumber: number | null
  detail: PullRequestDetailResult | null
  detailMode: DiffDetailMode
  error: string | null
  isApprovePending: boolean
  isLoading: boolean
  isMergePending: boolean
  isRefreshPending: boolean
  loadFileDiff: ChangeSetFileDiffLoader
  scopePath: string
  sourceKey: string
  viewMode: DiffViewMode
  onApprove: (body?: string) => Promise<void>
  onMerge: (method?: MergeMethod) => Promise<void>
  onRefresh: () => void
}

const commitDateFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
})

function formatCommitDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ""
  }

  return commitDateFormatter.format(date)
}

function PullRequestPaneLoadingState() {
  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="border-b border-border/70 px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="size-9 rounded-md bg-muted" />
          <div className="min-w-0 flex-1">
            <div className="h-4 w-32 rounded-sm bg-muted/70" />
            <div className="mt-3 h-6 w-96 max-w-full rounded-sm bg-muted" />
            <div className="mt-3 h-7 w-[34rem] max-w-full rounded-sm bg-muted/55" />
          </div>
        </div>
      </div>
      <div className="flex flex-1 items-center justify-center gap-2 text-muted-foreground">
        <LoaderCircle className="size-4 animate-spin" />
        <span className="type-meta">Loading pull request</span>
      </div>
    </div>
  )
}

function PullRequestPaneMessage({
  Icon,
  title,
  description,
}: {
  Icon: typeof AlertCircle
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

function PullRequestBody({ detail }: { detail: PullRequestDetailResult }) {
  if (!detail.pr.body?.trim()) {
    return null
  }

  return (
    <section className="border-b border-border/60 px-5 py-4">
      <h2 className="type-section-label text-muted-foreground/70">Summary</h2>
      <div className="markdown-body mt-3 max-w-3xl">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{detail.pr.body}</ReactMarkdown>
      </div>
    </section>
  )
}

function PullRequestCommitList({ detail }: { detail: PullRequestDetailResult }) {
  if (detail.commits.length === 0) {
    return null
  }

  return (
    <section className="border-b border-border/60 px-5 py-4">
      <div className="mb-2 flex items-center gap-2 text-muted-foreground/78">
        <GitCommitHorizontal className="size-4" />
        <h2 className="type-section-label">Commits</h2>
      </div>
      <ol className="grid gap-1">
        {detail.commits.slice(0, 8).map((commit) => {
          const formattedDate = formatCommitDate(commit.authorDate)

          return (
            <li
              key={commit.hash}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md border border-border/55 bg-muted/20 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate type-meta font-medium text-foreground/88">
                  {commit.subject || "(no subject)"}
                </p>
                <p className="mt-0.5 truncate type-meta text-muted-foreground">
                  {commit.authorName || "Unknown author"}
                </p>
              </div>
              <div className="text-right">
                <p className="type-mono-meta text-primary/82">{commit.shortHash}</p>
                {formattedDate ? (
                  <p className="mt-0.5 type-mono-meta text-muted-foreground/62">
                    {formattedDate}
                  </p>
                ) : null}
              </div>
            </li>
          )
        })}
      </ol>
      {detail.commits.length > 8 ? (
        <p className="mt-2 type-meta text-muted-foreground">
          {detail.commits.length - 8} more commits on GitHub.
        </p>
      ) : null}
    </section>
  )
}

export function PullRequestDetailPane({
  selectedNumber,
  detail,
  detailMode,
  error,
  isApprovePending,
  isLoading,
  isMergePending,
  isRefreshPending,
  loadFileDiff,
  scopePath,
  sourceKey,
  viewMode,
  onApprove,
  onMerge,
  onRefresh,
}: PullRequestDetailPaneProps) {
  if (isLoading) {
    return <PullRequestPaneLoadingState />
  }

  if (error) {
    return (
      <PullRequestPaneMessage
        Icon={AlertCircle}
        title="Unable to load pull request"
        description={error}
      />
    )
  }

  if (selectedNumber == null) {
    return (
      <PullRequestPaneMessage
        Icon={GitPullRequest}
        title="Select a pull request"
        description="Choose an open pull request from the PR sidebar to review metadata and local diffs."
      />
    )
  }

  if (!detail) {
    return (
      <PullRequestPaneMessage
        Icon={GitPullRequest}
        title={`PR #${selectedNumber}`}
        description="Pull request metadata has not loaded yet."
      />
    )
  }

  return (
    <div className="no-scrollbar flex h-full min-h-0 flex-col overflow-y-auto overscroll-none bg-background">
      <PullRequestHeader
        detail={detail}
        isApprovePending={isApprovePending}
        isMergePending={isMergePending}
        isRefreshPending={isRefreshPending}
        onApprove={onApprove}
        onMerge={onMerge}
        onRefresh={onRefresh}
      />
      <PullRequestBody detail={detail} />
      <PullRequestCommitList detail={detail} />

      {detail.localDiff ? (
        <div className="border-b border-amber-500/20 bg-amber-500/8 px-5 py-3">
          <p className="type-meta text-amber-200">{detail.localDiff.message}</p>
        </div>
      ) : null}

      <StackedChangeSetDiffs
        expandAll={detailMode === "fullFile"}
        files={detail.files}
        loadFileDiff={loadFileDiff}
        scopePath={detail.scopePath || scopePath}
        sourceKey={sourceKey}
        viewMode={viewMode}
      />
    </div>
  )
}
