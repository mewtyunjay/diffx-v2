import {
  FileStack,
  GitCommitHorizontal,
  GitMerge,
  GitPullRequest,
  type LucideIcon,
} from "lucide-react"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

export type SidebarPanelTab = "current" | "pull-request" | "conflicts" | "commits"

export type SidebarPanelTabDefinition = {
  id: SidebarPanelTab
  label: string
  Icon: LucideIcon
}

export const SIDEBAR_PANEL_TABS: SidebarPanelTabDefinition[] = [
  {
    id: "current",
    label: "Files",
    Icon: FileStack,
  },
  {
    id: "pull-request",
    label: "Pull request",
    Icon: GitPullRequest,
  },
  {
    id: "conflicts",
    label: "Merge conflicts",
    Icon: GitMerge,
  },
  {
    id: "commits",
    label: "Commits",
    Icon: GitCommitHorizontal,
  },
]

type SidebarPanelTabsProps = {
  activeTab: SidebarPanelTab
  onSelectTab: (tab: SidebarPanelTab) => void
}

export function SidebarPanelTabs({ activeTab, onSelectTab }: SidebarPanelTabsProps) {
  const activeIndex = Math.max(
    SIDEBAR_PANEL_TABS.findIndex((tab) => tab.id === activeTab),
    0
  )

  return (
    <div
      className="surface-sidebar-field relative mb-3 grid grid-cols-4 gap-0.5 overflow-hidden p-0.5"
      role="tablist"
      aria-label="Sidebar panel"
    >
      <span
        aria-hidden="true"
        className="absolute left-0.5 top-0.5 h-7 rounded-md bg-sidebar-accent transition-[transform,background-color] duration-200 ease-out motion-reduce:transition-none"
        style={{
          width: "calc((100% - 0.375rem - 0.25rem) / 4)",
          transform: `translateX(calc(${activeIndex} * (100% + 0.125rem)))`,
        }}
      />
      {SIDEBAR_PANEL_TABS.map(({ id, label, Icon }) => {
        const isActive = id === activeTab

        return (
          <Tooltip key={id}>
            <TooltipTrigger asChild>
              <button
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`sidebar-panel-${id}`}
                className={cn(
                  "relative z-10 flex h-7 items-center justify-center rounded-md text-sidebar-foreground/55 transition-colors duration-150 outline-none hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring/60",
                  isActive && "text-sidebar-accent-foreground"
                )}
                onClick={() => onSelectTab(id)}
              >
                <Icon className="size-3.5" />
                <span className="sr-only">{label}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={6}>
              {label}
            </TooltipContent>
          </Tooltip>
        )
      })}
    </div>
  )
}

export function SidebarPanelEmpty({ label }: { label: string }) {
  return (
    <div className="flex min-h-32 items-center justify-center px-4 py-8">
      <p className="text-center type-meta text-sidebar-foreground/50">{label}</p>
    </div>
  )
}
