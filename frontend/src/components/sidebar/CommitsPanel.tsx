import { AlertCircle, GitBranch, GitCommitHorizontal, LoaderCircle } from "lucide-react"
import * as React from "react"

import type { CommitItem } from "@/git/types"
import { SidebarPanelStickyHeader } from "@/components/sidebar/SidebarPanelStickyHeader"
import { cn } from "@/lib/utils"

type CommitsPanelProps = {
  currentRef: string
  commits: CommitItem[]
  isLoading: boolean
  hasMore: boolean
  error: string | null
  selectedCommitHash: string | null
  onSelectCommit: (commit: CommitItem) => void
  onLoadMore: () => void
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
  hasMore,
  error,
  selectedCommitHash,
  onSelectCommit,
  onLoadMore,
}: CommitsPanelProps) {
  const refLabel = currentRef || "HEAD"
  const loadMoreSentinelRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    const sentinel = loadMoreSentinelRef.current
    if (!sentinel || !hasMore || error) {
      return
    }

    const scrollRoot = sentinel.closest('[data-sidebar="content"]')
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          onLoadMore()
        }
      },
      {
        root: scrollRoot instanceof Element ? scrollRoot : null,
        rootMargin: "160px 0px",
      }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [error, hasMore, onLoadMore])

  return (
    <div className="flex min-h-0 flex-col">
      <SidebarPanelStickyHeader>
        <div className="flex items-center gap-2 px-1 text-sidebar-foreground/72">
          <GitBranch className="size-3.5 shrink-0 text-sidebar-foreground/45" />
          <p className="min-w-0 truncate type-meta font-medium">Commits on {refLabel}</p>
        </div>
      </SidebarPanelStickyHeader>

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
        <>
          <ol className="space-y-0.5">
            {commits.map((commit) => {
              const formattedDate = formatCommitDate(commit.authorDate)
              const isActive = selectedCommitHash === commit.hash

              return (
                <li key={commit.hash}>
                  <button
                    type="button"
                    aria-current={isActive ? "true" : undefined}
                    aria-label={`${commit.subject || "No subject"}, ${commit.shortHash}${formattedDate ? `, ${formattedDate}` : ""}`}
                    className={cn(
                      "flex h-11 w-full items-start gap-2 rounded-md px-1.5 py-1.5 text-left transition-colors hover:bg-[var(--surface-sidebar-hover)] focus-visible:ring-2 focus-visible:ring-sidebar-ring/60 focus-visible:outline-none",
                      isActive &&
                        "bg-[var(--surface-selected)] text-sidebar-foreground hover:bg-[var(--surface-selected)]"
                    )}
                    data-active={isActive}
                    onClick={() => onSelectCommit(commit)}
                  >
                    <GitCommitHorizontal
                      className={cn(
                        "mt-0.5 size-3.5 shrink-0 text-sidebar-foreground/38",
                        isActive && "text-sidebar-primary/90"
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "block truncate type-meta font-medium text-sidebar-foreground/86",
                          isActive && "text-sidebar-foreground"
                        )}
                      >
                        {commit.subject || "(no subject)"}
                      </span>
                      <span
                        className={cn(
                          "mt-0.5 flex min-w-0 items-center type-mono-meta text-sidebar-foreground/45",
                          isActive && "text-sidebar-foreground/62"
                        )}
                      >
                        <span className="shrink-0 text-[0.625rem] leading-none text-sidebar-primary/70">
                          {commit.shortHash}
                        </span>
                      </span>
                    </span>
                    <span
                      className={cn(
                        "shrink-0 pt-0.5 type-mono-meta text-sidebar-foreground/38",
                        isActive && "text-sidebar-foreground/58"
                      )}
                    >
                      {formattedDate}
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
          {hasMore || isLoading || error ? (
            <div
              ref={loadMoreSentinelRef}
              className="mt-2 flex min-h-10 items-center justify-center gap-2 border-t border-sidebar-border/50 pt-2 text-sidebar-foreground/45"
            >
              {isLoading ? (
                <>
                  <LoaderCircle className="size-3.5 animate-spin" />
                  <p className="type-meta">Loading more commits</p>
                </>
              ) : error ? (
                <>
                  <AlertCircle className="size-3.5" />
                  <p className="type-meta">{error}</p>
                </>
              ) : (
                <p className="type-meta">{commits.length} commits loaded</p>
              )}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
