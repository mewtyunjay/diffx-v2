import { useCallback, useRef, type KeyboardEvent } from "react"
import { LoaderCircle } from "lucide-react"

import type { BranchOption, ChangedFileItem, ComparisonMode } from "@/git/types"
import { CheckoutBranchPicker } from "@/components/sidebar/CheckoutBranchPicker"
import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import { SidebarFooter, useSidebar } from "@/components/ui/sidebar"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { SHORTCUTS, useShortcut } from "@/lib/shortcuts"

type GitActionsPanelProps = {
  branchName: string
  branches: BranchOption[]
  isBranchesLoading: boolean
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
  isFetchPending: boolean
  onFetch: () => void
  isPullPending: boolean
  onPull: () => void
  isCheckoutPending: boolean
  onCheckoutBranch: (branch: string) => void
}

export function GitActionsPanel({
  branchName,
  branches,
  isBranchesLoading,
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
  isFetchPending,
  onFetch,
  isPullPending,
  onPull,
  isCheckoutPending,
  onCheckoutBranch,
}: GitActionsPanelProps) {
  const { open, setOpen } = useSidebar()
  const commitMessageRef = useRef<HTMLTextAreaElement>(null)
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
  const canTriggerCommit = !isCommitPending && !isPushPending && canCommit
  const canTriggerPush = !isCommitPending && !isPushPending && canPush
  const canTriggerFetch = canUseGitActions && !isFetchPending && !isPullPending && !isCheckoutPending
  const canTriggerPull = canUseGitActions && !isFetchPending && !isPullPending && !isCheckoutPending
  const canTriggerBranchSwitch = canUseGitActions && !isCheckoutPending && !isPullPending

  const focusCommitMessage = useCallback(() => {
    if (open) {
      commitMessageRef.current?.focus()
      return
    }

    setOpen(true)
    requestAnimationFrame(() => {
      commitMessageRef.current?.focus()
    })
  }, [open, setOpen])

  useShortcut("focusCommitMessage", focusCommitMessage)
  useShortcut("pushBranch", () => {
    if (canTriggerPush) {
      onPush()
    }
  })

  const handleCommitMessageKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      const isShiftPushShortcut =
        event.shiftKey &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        event.key.toLowerCase() === "p"

      if (isShiftPushShortcut) {
        event.preventDefault()
        if (canTriggerPush) {
          onPush()
        }
        return
      }

      const isCommitEnter =
        event.key === "Enter" &&
        !event.shiftKey &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey

      if (!isCommitEnter) {
        return
      }

      event.preventDefault()
      if (canTriggerCommit) {
        onCommit()
      }
    },
    [canTriggerCommit, canTriggerPush, onCommit, onPush]
  )

  return (
    <SidebarFooter className="border-t border-sidebar-border/70 p-2.5">
      <div className="space-y-2">
        <div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1.5">
              <CheckoutBranchPicker
                branchName={branchName}
                branches={branches}
                disabled={!canTriggerBranchSwitch || isBranchesLoading}
                isSwitchPending={isCheckoutPending}
                onSelectBranch={onCheckoutBranch}
              />
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
              ref={commitMessageRef}
              value={commitMessage}
              onChange={(event) => onCommitMessageChange(event.target.value)}
              onKeyDown={handleCommitMessageKeyDown}
              placeholder="Commit message..."
              className="surface-sidebar-field focus-ring-default min-h-14 w-full resize-y px-2.5 py-1.5 type-meta text-sidebar-foreground placeholder:text-sidebar-foreground/40"
            />
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="sm"
                    className="flex-1"
                    disabled={!canTriggerCommit}
                    onClick={onCommit}
                  >
                    {isCommitPending ? <LoaderCircle className="animate-spin" /> : null}
                    Commit
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={6}>
                  Commit staged changes
                  <Kbd keys={SHORTCUTS.focusCommitMessage.keys} />
                  <Kbd keys={["Enter"]} />
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    disabled={!canTriggerPush}
                    onClick={onPush}
                  >
                    {isPushPending ? <LoaderCircle className="animate-spin" /> : null}
                    Push
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={6}>
                  Push current branch
                  <Kbd keys={SHORTCUTS.pushBranch.keys} />
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="flex-1"
                disabled={!canTriggerFetch}
                onClick={onFetch}
              >
                {isFetchPending ? <LoaderCircle className="animate-spin" /> : null}
                Fetch
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="flex-1"
                disabled={!canTriggerPull}
                onClick={onPull}
              >
                {isPullPending ? <LoaderCircle className="animate-spin" /> : null}
                Pull
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </SidebarFooter>
  )
}
