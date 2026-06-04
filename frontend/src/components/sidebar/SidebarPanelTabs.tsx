import {
  Code2,
  GitCommitHorizontal,
  GitMerge,
  GitPullRequest,
  type LucideIcon,
} from "lucide-react"

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
    label: "Diff",
    Icon: Code2,
  },
  {
    id: "pull-request",
    label: "PR",
    Icon: GitPullRequest,
  },
  {
    id: "conflicts",
    label: "Conflicts",
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
  tabs: SidebarPanelTabDefinition[]
  onSelectTab: (tab: SidebarPanelTab) => void
}

export function SidebarPanelTabs({ activeTab, tabs, onSelectTab }: SidebarPanelTabsProps) {
  return (
    <div
      className="-mx-2 mb-3 flex min-h-11 items-end gap-1 border-b border-sidebar-border/70 px-2"
      role="tablist"
      aria-label="Sidebar panel"
    >
      {tabs.map(({ id, label, Icon }) => {
        const isActive = id === activeTab

        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={`sidebar-panel-${id}`}
            className={cn(
              "relative flex h-10 min-w-0 flex-1 items-center justify-center gap-1 px-1 text-[0.8125rem] font-semibold leading-5 text-sidebar-foreground/62 transition-colors outline-none hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring/60",
              "after:absolute after:bottom-[-1px] after:left-0 after:h-0.5 after:w-full after:origin-center after:scale-x-0 after:bg-sidebar-primary after:transition-transform after:duration-150 after:ease-out",
              isActive &&
                "text-sidebar-foreground after:scale-x-100"
            )}
            onClick={() => onSelectTab(id)}
          >
            <Icon className="size-3.5 shrink-0" />
            <span className="whitespace-nowrap">{label}</span>
          </button>
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
