import * as React from "react"

import { cn } from "@/lib/utils"

type SidebarPanelStickyHeaderProps = React.ComponentProps<"div"> & {
  showDivider?: boolean
}

export function SidebarPanelStickyHeader({
  className,
  showDivider = false,
  ...props
}: SidebarPanelStickyHeaderProps) {
  return (
    <div
      className={cn(
        "sticky top-0 z-20 -mx-2 mb-2 border-b bg-sidebar px-2 pb-2 transition-colors",
        showDivider ? "border-sidebar-border/50" : "border-transparent",
        className
      )}
      {...props}
    />
  )
}
