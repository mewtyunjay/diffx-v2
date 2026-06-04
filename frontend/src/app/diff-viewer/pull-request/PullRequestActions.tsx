import { useState } from "react"
import { ExternalLink, GitMerge, LoaderCircle, RefreshCw, ShieldCheck } from "lucide-react"

import {
  ActionTooltipButton,
  DialogFact,
  mergeMethodLabels,
} from "@/app/diff-viewer/pull-request/PullRequestActionHelpers"
import type { MergeMethod, PullRequestDetailResult } from "@/git/types"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "@/components/ui/sonner"
import { cn } from "@/lib/utils"

type PullRequestActionsProps = {
  detail: PullRequestDetailResult
  isApprovePending: boolean
  isMergePending: boolean
  isRefreshPending: boolean
  onApprove: (body?: string) => Promise<void>
  onMerge: (method?: MergeMethod) => Promise<void>
  onRefresh: () => void
}

export function PullRequestActions({
  detail,
  isApprovePending,
  isMergePending,
  isRefreshPending,
  onApprove,
  onMerge,
  onRefresh,
}: PullRequestActionsProps) {
  const [approveOpen, setApproveOpen] = useState(false)
  const [mergeOpen, setMergeOpen] = useState(false)
  const [approvalBody, setApprovalBody] = useState("")
  const [userSelectedMergeMethod, setUserSelectedMergeMethod] = useState<MergeMethod | undefined>()
  const defaultMergeMethod = detail.merge.defaultMethod ?? detail.merge.allowedMethods[0]
  const selectedMergeMethod =
    userSelectedMergeMethod && detail.merge.allowedMethods.includes(userSelectedMergeMethod)
      ? userSelectedMergeMethod
      : defaultMergeMethod

  const mergeDisabledReason =
    detail.merge.blockedReason ||
    (!selectedMergeMethod ? "No merge method is available for this repository." : undefined)
  const isMergeDisabled = Boolean(mergeDisabledReason) || isMergePending

  const handleApprove = async () => {
    try {
      await onApprove(approvalBody.trim() || undefined)
      toast.success(`Approved PR #${detail.pr.number}.`)
      setApprovalBody("")
      setApproveOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to approve pull request.")
    }
  }

  const handleMerge = async () => {
    try {
      await onMerge(selectedMergeMethod)
      toast.success(`Merged PR #${detail.pr.number}.`)
      setMergeOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to merge pull request.")
    }
  }

  return (
    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
      <Button size="sm" variant="outline" asChild>
        <a href={detail.pr.url} target="_blank" rel="noreferrer">
          <ExternalLink className="size-3.5" />
          GitHub
        </a>
      </Button>
      <Button type="button" size="icon-sm" variant="outline" aria-label="Refresh PR" onClick={onRefresh}>
        {isRefreshPending ? (
          <LoaderCircle className="size-3.5 animate-spin" />
        ) : (
          <RefreshCw className="size-3.5" />
        )}
      </Button>

      <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isApprovePending}
          onClick={() => setApproveOpen(true)}
        >
          {isApprovePending ? (
            <LoaderCircle className="size-3.5 animate-spin" />
          ) : (
            <ShieldCheck className="size-3.5" />
          )}
          Approve
        </Button>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve PR #{detail.pr.number}</DialogTitle>
            <DialogDescription>
              Submit an approving GitHub review for {detail.pr.title}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2">
            <DialogFact label="Author" value={detail.pr.author || "Unknown"} />
            <DialogFact label="Base" value={detail.base.refName || "base branch"} />
            <DialogFact label="Checks" value={detail.checks.conclusion} />
            <DialogFact label="Review" value={detail.reviews.decision || "No decision"} />
          </div>
          <label className="grid gap-1.5">
            <span className="type-section-label text-muted-foreground/70">Approval body</span>
            <textarea
              value={approvalBody}
              onChange={(event) => setApprovalBody(event.target.value)}
              className="min-h-20 resize-y rounded-md border border-border bg-background px-3 py-2 type-meta text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </label>
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button type="button" size="sm" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="button" size="sm" disabled={isApprovePending} onClick={handleApprove}>
              {isApprovePending ? <LoaderCircle className="size-3.5 animate-spin" /> : null}
              Approve
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={mergeOpen} onOpenChange={setMergeOpen}>
        <ActionTooltipButton disabledReason={mergeDisabledReason}>
          <Button
            type="button"
            size="sm"
            disabled={isMergeDisabled}
            onClick={() => setMergeOpen(true)}
          >
            {isMergePending ? (
              <LoaderCircle className="size-3.5 animate-spin" />
            ) : (
              <GitMerge className="size-3.5" />
            )}
            Merge
          </Button>
        </ActionTooltipButton>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Merge PR #{detail.pr.number}</DialogTitle>
            <DialogDescription>
              Merge into {detail.base.refName}. This does not checkout or merge into your local branch.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2">
            <DialogFact label="Author" value={detail.pr.author || "Unknown"} />
            <DialogFact label="Target" value={detail.base.refName || "base branch"} />
            <DialogFact label="Checks" value={detail.checks.conclusion} />
            <DialogFact label="Review" value={detail.reviews.decision || "No decision"} />
          </div>
          {detail.merge.allowedMethods.length > 1 ? (
            <div className="grid gap-1.5">
              <p className="type-section-label text-muted-foreground/70">Merge method</p>
              <div className="surface-segmented flex flex-wrap items-center gap-0.5 p-0.5">
                {detail.merge.allowedMethods.map((method) => {
                  const isActive = method === selectedMergeMethod

                  return (
                    <Button
                      key={method}
                      type="button"
                      size="xs"
                      variant={isActive ? "secondary" : "ghost"}
                      aria-pressed={isActive}
                      onClick={() => setUserSelectedMergeMethod(method)}
                    >
                      {mergeMethodLabels[method]}
                    </Button>
                  )
                })}
              </div>
            </div>
          ) : null}
          {mergeDisabledReason ? (
            <div className="rounded-md border border-amber-500/25 bg-amber-500/10 px-3 py-2 type-meta text-amber-200">
              {mergeDisabledReason}
            </div>
          ) : null}
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button type="button" size="sm" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="button"
              size="sm"
              disabled={isMergeDisabled || isMergePending}
              onClick={handleMerge}
            >
              {isMergePending ? <LoaderCircle className="size-3.5 animate-spin" /> : null}
              {selectedMergeMethod ? mergeMethodLabels[selectedMergeMethod] : "Merge"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {detail.merge.allowedMethods.length > 0 ? (
        <span className={cn("type-meta text-muted-foreground", detail.merge.canMerge && "hidden md:inline")}>
          {detail.merge.defaultMethod
            ? `${mergeMethodLabels[detail.merge.defaultMethod]} to ${detail.base.refName}`
            : `Merge to ${detail.base.refName}`}
        </span>
      ) : null}
    </div>
  )
}
