import { LoaderCircle } from "lucide-react"

import type { ChangedFileItem, ComparisonMode } from "@/git/types"
import { Button } from "@/components/ui/button"
import { SidebarFooter } from "@/components/ui/sidebar"

type GitActionsPanelProps = {
  comparisonMode: ComparisonMode
  files: ChangedFileItem[]
  hiddenStagedFileCount: number
  commitMessage: string
  isCommitPending: boolean
  onCommitMessageChange: (value: string) => void
  onCommit: () => void
  isPushPending: boolean
  showPushAction: boolean
  onPush: () => void
}

export function GitActionsPanel({
  comparisonMode,
  files,
  hiddenStagedFileCount,
  commitMessage,
  isCommitPending,
  onCommitMessageChange,
  onCommit,
  isPushPending,
  showPushAction,
  onPush,
}: GitActionsPanelProps) {
  const stagedVisibleCount = files.filter((file) => file.hasStagedChanges).length
  const totalStagedCount = stagedVisibleCount + hiddenStagedFileCount

  const canUseGitActions = comparisonMode === "head"
  const canCommit = canUseGitActions && stagedVisibleCount > 0 && hiddenStagedFileCount === 0
  const showCommitArea = canCommit
  const showPushButton = canUseGitActions && (canCommit || showPushAction)

  return (
    <SidebarFooter className="border-t border-sidebar-border/70 bg-sidebar/95 p-3 backdrop-blur">
      <div className="space-y-3">
        <div>
          <p className="type-overline text-sidebar-foreground/65">
            Git actions
          </p>
          <p className="mt-1 type-meta font-medium text-sidebar-foreground type-data">
            {totalStagedCount === 0
              ? "No staged changes"
              : `${totalStagedCount} staged ${totalStagedCount === 1 ? "file" : "files"}`}
          </p>
          {comparisonMode !== "head" ? (
            <p className="measure-readable mt-1 type-meta text-sidebar-foreground/60">
              Switch to HEAD to commit or push.
            </p>
          ) : hiddenStagedFileCount > 0 ? (
            <p className="measure-readable mt-1 type-meta text-amber-200">
              {hiddenStagedFileCount} staged {hiddenStagedFileCount === 1 ? "file is" : "files are"} outside
              this scope. Open the repo root to commit safely.
            </p>
          ) : null}
        </div>

        {showCommitArea ? (
          <div className="space-y-3">
            <textarea
              value={commitMessage}
              onChange={(event) => onCommitMessageChange(event.target.value)}
              placeholder="Commit message..."
              className="surface-sidebar-field focus-ring-default min-h-20 w-full resize-y px-2.5 py-2 type-meta text-sidebar-foreground placeholder:text-sidebar-foreground/40"
            />
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                className="flex-1"
                disabled={isCommitPending || isPushPending || !commitMessage.trim() || !canCommit}
                onClick={onCommit}
              >
                {isCommitPending ? <LoaderCircle className="animate-spin" /> : null}
                Commit
              </Button>
              {showPushButton ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  disabled={isCommitPending || isPushPending}
                  onClick={onPush}
                >
                  {isPushPending ? <LoaderCircle className="animate-spin" /> : null}
                  Push
                </Button>
              ) : null}
            </div>
          </div>
        ) : showPushButton ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="w-full"
            disabled={isCommitPending || isPushPending}
            onClick={onPush}
          >
            {isPushPending ? <LoaderCircle className="animate-spin" /> : null}
            Push
          </Button>
        ) : null}
      </div>
    </SidebarFooter>
  )
}
