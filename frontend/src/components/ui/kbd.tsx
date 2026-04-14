import { Fragment } from "react"

import { formatKeyForDisplay, normalizeKeys, type ShortcutKey } from "@/lib/keyboard"
import { cn } from "@/lib/utils"

type KbdProps = {
  keys: readonly ShortcutKey[]
  className?: string
}

export function Kbd({ keys, className }: KbdProps) {
  const ordered = normalizeKeys(keys)

  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "inline-flex items-center gap-[0.125rem] font-sans text-[0.6875rem] leading-none tracking-tight",
        className
      )}
    >
      {ordered.map((key, index) => (
        <Fragment key={`${key}-${index}`}>
          <span className="inline-flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-sm border border-border/70 bg-muted/80 px-[0.3125rem] py-[1px] font-medium text-foreground/80 in-data-[slot=tooltip-content]:border-background/20 in-data-[slot=tooltip-content]:bg-background/10 in-data-[slot=tooltip-content]:text-background/90">
            {formatKeyForDisplay(key)}
          </span>
        </Fragment>
      ))}
    </kbd>
  )
}
