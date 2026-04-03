import type { ReactNode } from "react"

type DiffPlaceholderProps = {
  children: ReactNode
}

export function DiffPlaceholder({ children }: DiffPlaceholderProps) {
  return (
    <div className="flex h-full min-h-0 items-center justify-center rounded-lg border border-dashed border-border/60 bg-background/40 px-6 text-center type-meta text-muted-foreground">
      {children}
    </div>
  )
}
