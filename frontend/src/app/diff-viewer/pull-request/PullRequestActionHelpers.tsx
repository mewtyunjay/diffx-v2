import type { ReactNode } from "react"

import type { MergeMethod } from "@/git/types"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

export const mergeMethodLabels: Record<MergeMethod, string> = {
  merge: "Merge",
  squash: "Squash",
  rebase: "Rebase",
}

export function ActionTooltipButton({
  children,
  disabledReason,
}: {
  children: ReactNode
  disabledReason?: string
}) {
  if (!disabledReason) {
    return children
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">{children}</span>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6}>
        {disabledReason}
      </TooltipContent>
    </Tooltip>
  )
}

export function DialogFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-border/65 bg-muted/25 px-3 py-2">
      <p className="type-section-label text-muted-foreground/70">{label}</p>
      <p className="mt-1 truncate type-meta font-medium text-foreground" title={value}>
        {value}
      </p>
    </div>
  )
}
