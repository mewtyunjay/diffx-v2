import { AlertCircle, GitBranch, GitCommitHorizontal, LoaderCircle } from "lucide-react"

import type { CommitItem } from "@/git/types"

type CommitsPanelProps = {
  currentRef: string
  commits: CommitItem[]
  isLoading: boolean
  error: string | null
  selectedCommitHash: string | null
  onSelectCommit: (commit: CommitItem) => void
}

const compactDateFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
})

function formatCommitDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ""
  }

  return compactDateFormatter.format(date)
}

export function CommitsPanel({
  currentRef,
  commits,
  isLoading,
  error,
  selectedCommitHash,
  onSelectCommit,
}: CommitsPanelProps) {
  const refLabel = currentRef || "HEAD"

  return (
    <div className="flex min-h-0 flex-col">
      <div className="mb-2 flex items-center gap-2 px-1 text-sidebar-foreground/72">
        <GitBranch className="size-3.5 shrink-0 text-sidebar-foreground/45" />
        <p className="min-w-0 truncate type-meta font-medium">Commits on {refLabel}</p>
      </div>

      {isLoading && commits.length === 0 ? (
        <div className="flex min-h-32 items-center justify-center gap-2 px-4 py-8 text-sidebar-foreground/50">
          <LoaderCircle className="size-4 animate-spin" />
          <p className="type-meta">Loading commits</p>
        </div>
      ) : null}

      {error && commits.length === 0 ? (
        <div className="flex min-h-32 items-center justify-center gap-2 px-4 py-8 text-sidebar-foreground/50">
          <AlertCircle className="size-4" />
          <p className="type-meta">{error}</p>
        </div>
      ) : null}

      {!isLoading && !error && commits.length === 0 ? (
        <div className="flex min-h-32 items-center justify-center px-4 py-8">
          <p className="text-center type-meta text-sidebar-foreground/50">No commits found</p>
        </div>
      ) : null}

      {commits.length > 0 ? (
        <ol className="space-y-0.5">
          {commits.map((commit) => (
            <li key={commit.hash}>
              <button
                type="button"
                className="flex w-full items-start gap-2 rounded-md px-1.5 py-1.5 text-left transition-colors hover:bg-[var(--surface-sidebar-hover)] data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground"
                data-active={selectedCommitHash === commit.hash}
                onClick={() => onSelectCommit(commit)}
              >
                <GitCommitHorizontal className="mt-0.5 size-3.5 shrink-0 text-sidebar-foreground/38" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate type-meta font-medium text-sidebar-foreground/86">
                    {commit.subject || "(no subject)"}
                  </span>
                  <span className="mt-0.5 flex min-w-0 items-center type-mono-meta text-sidebar-foreground/45">
                    <span className="shrink-0 text-[0.625rem] leading-none text-sidebar-primary/70">
                      {commit.shortHash}
                    </span>
                  </span>
                </span>
                <span className="shrink-0 pt-0.5 type-mono-meta text-sidebar-foreground/38">
                  {formatCommitDate(commit.authorDate)}
                </span>
              </button>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  )
}
