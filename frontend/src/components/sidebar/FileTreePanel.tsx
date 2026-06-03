import * as React from "react"

import type { ChangedFileItem, ComparisonMode } from "@/git/types"
import type { SidebarTreeFolderNode } from "@/components/file-tree/tree-model"
import { CurrentFilesPanel } from "@/components/sidebar/CurrentFilesPanel"
import { SidebarContent } from "@/components/ui/sidebar"
import { useShortcut } from "@/lib/shortcuts"
import { cn } from "@/lib/utils"
import {
  SIDEBAR_PANEL_TABS,
  SidebarPanelEmpty,
  SidebarPanelTabs,
  type SidebarPanelTab,
} from "@/components/sidebar/SidebarPanelTabs"

type FileTreePanelProps = {
  files: ChangedFileItem[]
  totalFileCount: number
  searchQuery: string
  onSearchQueryChange: (query: string) => void
  tree: SidebarTreeFolderNode<ChangedFileItem>
  expandedPaths: string[]
  hasExpandableFolders: boolean
  areAllFoldersExpanded: boolean
  onToggleFolder: (path: string) => void
  onToggleAllFolders: () => void
  selectedFile: ChangedFileItem | null
  scopePath: string
  comparisonMode: ComparisonMode
  isMergeInProgress: boolean
  onSelectFile: (path: string) => void
  stagePendingPaths: string[]
  isBulkStagePending: boolean
  onToggleStage: (file: ChangedFileItem) => void
  onStageAll: () => void
  onUnstageAll: () => void
}

export function FileTreePanel({
  files,
  totalFileCount,
  searchQuery,
  onSearchQueryChange,
  tree,
  expandedPaths,
  hasExpandableFolders,
  areAllFoldersExpanded,
  onToggleFolder,
  onToggleAllFolders,
  selectedFile,
  scopePath,
  comparisonMode,
  isMergeInProgress,
  onSelectFile,
  stagePendingPaths,
  isBulkStagePending,
  onToggleStage,
  onStageAll,
  onUnstageAll,
}: FileTreePanelProps) {
  const searchInputRef = React.useRef<HTMLInputElement | null>(null)
  const [activeTab, setActiveTab] = React.useState<SidebarPanelTab>("current")
  const [tabDirection, setTabDirection] = React.useState<"forward" | "backward">("forward")

  useShortcut("focusFileSearch", () => {
    searchInputRef.current?.focus()
    searchInputRef.current?.select()
  })

  const activeTabDefinition =
    SIDEBAR_PANEL_TABS.find((tab) => tab.id === activeTab) ?? SIDEBAR_PANEL_TABS[0]

  const handleSelectTab = React.useCallback(
    (nextTab: SidebarPanelTab) => {
      if (nextTab === activeTab) {
        return
      }

      const currentIndex = SIDEBAR_PANEL_TABS.findIndex((tab) => tab.id === activeTab)
      const nextIndex = SIDEBAR_PANEL_TABS.findIndex((tab) => tab.id === nextTab)
      setTabDirection(nextIndex > currentIndex ? "forward" : "backward")
      setActiveTab(nextTab)
    },
    [activeTab]
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 px-2 pb-2 pt-3">
        <SidebarPanelTabs activeTab={activeTab} onSelectTab={handleSelectTab} />
      </div>
      <SidebarContent>
        <div
          key={activeTab}
          id={`sidebar-panel-${activeTab}`}
          role="tabpanel"
          aria-label={activeTabDefinition.label}
          className={cn(
            "px-2 pb-2 duration-200 ease-out animate-in fade-in-0 motion-reduce:animate-none",
            tabDirection === "forward" ? "slide-in-from-right-2" : "slide-in-from-left-2"
          )}
        >
          {activeTab === "current" ? (
            <CurrentFilesPanel
              files={files}
              totalFileCount={totalFileCount}
              searchQuery={searchQuery}
              onSearchQueryChange={onSearchQueryChange}
              searchInputRef={searchInputRef}
              tree={tree}
              expandedPaths={expandedPaths}
              hasExpandableFolders={hasExpandableFolders}
              areAllFoldersExpanded={areAllFoldersExpanded}
              onToggleFolder={onToggleFolder}
              onToggleAllFolders={onToggleAllFolders}
              selectedFile={selectedFile}
              scopePath={scopePath}
              comparisonMode={comparisonMode}
              isMergeInProgress={isMergeInProgress}
              onSelectFile={onSelectFile}
              stagePendingPaths={stagePendingPaths}
              isBulkStagePending={isBulkStagePending}
              onToggleStage={onToggleStage}
              onStageAll={onStageAll}
              onUnstageAll={onUnstageAll}
            />
          ) : (
            <SidebarPanelEmpty label={activeTabDefinition.label} />
          )}
        </div>
      </SidebarContent>
    </div>
  )
}
