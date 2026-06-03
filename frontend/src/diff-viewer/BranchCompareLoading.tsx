import { GitBranch, LoaderCircle } from "lucide-react"

type BranchCompareLoadingProps = {
  baseRef: string
}

export function BranchCompareLoading({ baseRef }: BranchCompareLoadingProps) {
  return (
    <div className="flex min-h-full items-center justify-center px-6 py-16" aria-live="polite">
      <div className="flex max-w-full flex-col items-center gap-3 text-center">
        <LoaderCircle className="size-5 animate-spin text-primary" />
        <p className="flex max-w-full flex-wrap items-center justify-center gap-2 type-meta text-muted-foreground">
          <span>Getting data from</span>
          <span className="surface-chip inline-flex max-w-[min(28rem,80vw)] items-center gap-1.5 px-2.5 py-1 font-medium text-foreground">
            <GitBranch className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="min-w-0 truncate">{baseRef}</span>
          </span>
        </p>
      </div>
    </div>
  )
}
