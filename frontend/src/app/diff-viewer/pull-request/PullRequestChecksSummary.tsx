import { AlertCircle, CheckCircle2, CircleDashed, Clock3 } from "lucide-react"

import type { PullRequestChecksSummary as PullRequestChecksSummaryType } from "@/git/types"
import { cn } from "@/lib/utils"

type PullRequestChecksSummaryProps = {
  checks: PullRequestChecksSummaryType
}

function checksTone(conclusion: PullRequestChecksSummaryType["conclusion"]) {
  switch (conclusion) {
    case "success":
      return {
        Icon: CheckCircle2,
        label: "Checks passing",
        className: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
      }
    case "failure":
      return {
        Icon: AlertCircle,
        label: "Checks failing",
        className: "border-rose-500/25 bg-rose-500/10 text-rose-300",
      }
    case "pending":
      return {
        Icon: Clock3,
        label: "Checks pending",
        className: "border-amber-500/25 bg-amber-500/10 text-amber-300",
      }
    default:
      return {
        Icon: CircleDashed,
        label: "Checks unavailable",
        className: "border-border bg-muted/35 text-muted-foreground",
      }
  }
}

export function PullRequestChecksSummary({ checks }: PullRequestChecksSummaryProps) {
  const tone = checksTone(checks.conclusion)
  const Icon = tone.Icon
  const countLabel =
    checks.totalCount === 0
      ? "No checks reported"
      : `${checks.successCount}/${checks.totalCount} passing`

  return (
    <div className={cn("rounded-md border px-3 py-2", tone.className)}>
      <div className="flex items-center gap-2">
        <Icon className="size-4 shrink-0" />
        <div className="min-w-0">
          <p className="type-meta font-medium">{tone.label}</p>
          <p className="mt-0.5 type-meta opacity-78">{countLabel}</p>
        </div>
      </div>
    </div>
  )
}
