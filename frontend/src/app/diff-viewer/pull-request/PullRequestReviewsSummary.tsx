import { CheckCircle2, CircleDashed, MessageSquareWarning, UserRoundCheck } from "lucide-react"

import type { PullRequestReviewsSummary as PullRequestReviewsSummaryType } from "@/git/types"
import { cn } from "@/lib/utils"

type PullRequestReviewsSummaryProps = {
  reviews: PullRequestReviewsSummaryType
}

function reviewTone(decision?: PullRequestReviewsSummaryType["decision"]) {
  switch (decision) {
    case "APPROVED":
      return {
        Icon: CheckCircle2,
        label: "Approved",
        className: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
      }
    case "CHANGES_REQUESTED":
      return {
        Icon: MessageSquareWarning,
        label: "Changes requested",
        className: "border-rose-500/25 bg-rose-500/10 text-rose-300",
      }
    case "REVIEW_REQUIRED":
      return {
        Icon: UserRoundCheck,
        label: "Review required",
        className: "border-amber-500/25 bg-amber-500/10 text-amber-300",
      }
    default:
      return {
        Icon: CircleDashed,
        label: "No review decision",
        className: "border-border bg-muted/35 text-muted-foreground",
      }
  }
}

export function PullRequestReviewsSummary({ reviews }: PullRequestReviewsSummaryProps) {
  const tone = reviewTone(reviews.decision)
  const Icon = tone.Icon
  const latestReviewers = reviews.latestReviews
    .slice(0, 3)
    .map((review) => review.author)
    .filter(Boolean)
    .join(", ")
  const reviewerLabel =
    reviews.requiredReviewers.length > 0
      ? `Waiting on ${reviews.requiredReviewers.slice(0, 3).join(", ")}`
      : latestReviewers || "No requested reviewers"

  return (
    <div className={cn("rounded-md border px-3 py-2", tone.className)}>
      <div className="flex items-center gap-2">
        <Icon className="size-4 shrink-0" />
        <div className="min-w-0">
          <p className="type-meta font-medium">{tone.label}</p>
          <p className="mt-0.5 truncate type-meta opacity-78" title={reviewerLabel}>
            {reviewerLabel}
          </p>
        </div>
      </div>
    </div>
  )
}
