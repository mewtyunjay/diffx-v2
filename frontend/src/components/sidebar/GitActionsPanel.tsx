import { GitBranch, LoaderCircle } from "lucide-react"

import type { ChangedFileItem, ComparisonMode } from "@/git/types"
import { Button } from "@/components/ui/button"
import { SidebarFooter } from "@/components/ui/sidebar"

type GitActionsPanelProps = {
  branchName: string
  comparisonMode: ComparisonMode
  files: ChangedFileItem[]
  aheadCount: number
  hiddenStagedFileCount: number
  commitMessage: string
  isCommitPending: boolean
  onCommitMessageChange: (value: string) => void
  onCommit: () => void
  isPushPending: boolean
  onPush: () => void
}

export function GitActionsPanel({
  branchName,
  comparisonMode,
  files,
  aheadCount,
  hiddenStagedFileCount,
  commitMessage,
  isCommitPending,
  onCommitMessageChange,
  onCommit,
  isPushPending,
  onPush,
}: GitActionsPanelProps) {
  const stagedVisibleCount = files.filter((file) => file.hasStagedChanges).length
  const totalStagedCount = stagedVisibleCount + hiddenStagedFileCount

  const canUseGitActions = comparisonMode === "head"
  const hasCommitMessage = commitMessage.trim().length > 0
  const canCommit =
    canUseGitActions &&
    stagedVisibleCount > 0 &&
    hiddenStagedFileCount === 0 &&
    hasCommitMessage
  const canPush = canUseGitActions && aheadCount > 0

  return (
    <SidebarFooter className="border-t border-sidebar-border/70 p-2.5">
      <div className="space-y-2">
        <div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1.5">
              <GitBranch className="size-3.5 shrink-0 text-sidebar-foreground/60" />
              <p className="truncate type-meta font-medium text-sidebar-foreground type-data">
                {branchName}
              </p>
            </div>
            <p className="shrink-0 type-meta font-medium text-sidebar-foreground type-data">
              {canUseGitActions ? `${totalStagedCount} staged` : "In comparison mode"}
            </p>
          </div>
          {!canUseGitActions ? (
            <p className="mt-1 truncate type-meta text-sidebar-foreground/65">
              Switch to HEAD to commit or push.
            </p>
          ) : null}
        </div>

        {canUseGitActions ? (
          <div className="space-y-2">
            <textarea
              value={commitMessage}
              onChange={(event) => onCommitMessageChange(event.target.value)}
              placeholder="Commit message..."
              className="surface-sidebar-field focus-ring-default min-h-14 w-full resize-y px-2.5 py-1.5 type-meta text-sidebar-foreground placeholder:text-sidebar-foreground/40"
            />
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                className="flex-1"
                disabled={isCommitPending || isPushPending || !canCommit}
                onClick={onCommit}
              >
                {isCommitPending ? <LoaderCircle className="animate-spin" /> : null}
                Commit
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="flex-1"
                disabled={isCommitPending || isPushPending || !canPush}
                onClick={onPush}
              >
                {isPushPending ? <LoaderCircle className="animate-spin" /> : null}
                Push
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </SidebarFooter>
  )
}
