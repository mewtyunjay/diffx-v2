import * as React from "react"

import type { ChangedFileItem, ComparisonMode } from "@/git/types"
import type { CommitItem } from "@/git/types"
import type { SidebarTreeFolderNode } from "@/components/file-tree/tree-model"
import { CommitsPanel } from "@/components/sidebar/CommitsPanel"
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
  activeTab: SidebarPanelTab
  onActiveTabChange: (tab: SidebarPanelTab) => void
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
  currentRef: string
  commits: CommitItem[]
  isCommitsLoading: boolean
  hasMoreCommits: boolean
  commitsError: string | null
  selectedCommitHash: string | null
  showConflictsTab: boolean
  onSelectCommit: (commit: CommitItem) => void
  onLoadMoreCommits: () => void
  pullRequestPanel: React.ReactNode
  gitActionsPanel: React.ReactNode
}

export function FileTreePanel({
  activeTab,
  onActiveTabChange,
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
  currentRef,
  commits,
  isCommitsLoading,
  hasMoreCommits,
  commitsError,
  selectedCommitHash,
  showConflictsTab,
  onSelectCommit,
  onLoadMoreCommits,
  pullRequestPanel,
  gitActionsPanel,
}: FileTreePanelProps) {
  const searchInputRef = React.useRef<HTMLInputElement | null>(null)
  const [tabDirection, setTabDirection] = React.useState<"forward" | "backward">("forward")

  useShortcut("focusFileSearch", () => {
    searchInputRef.current?.focus()
    searchInputRef.current?.select()
  })

  const visiblePanelTabs = React.useMemo(
    () =>
      SIDEBAR_PANEL_TABS.filter((tab) => tab.id !== "conflicts" || showConflictsTab),
    [showConflictsTab]
  )
  const activeTabDefinition =
    visiblePanelTabs.find((tab) => tab.id === activeTab) ?? visiblePanelTabs[0]
  const isCurrentTab = activeTab === "current"

  const handleSelectTab = React.useCallback(
    (nextTab: SidebarPanelTab) => {
      if (nextTab === activeTab) {
        return
      }

      const currentIndex = visiblePanelTabs.findIndex((tab) => tab.id === activeTab)
      const nextIndex = visiblePanelTabs.findIndex((tab) => tab.id === nextTab)
      setTabDirection(nextIndex > currentIndex ? "forward" : "backward")
      onActiveTabChange(nextTab)
    },
    [activeTab, onActiveTabChange, visiblePanelTabs]
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="relative z-10 shrink-0 bg-sidebar px-2 pb-2 pt-3">
        <SidebarPanelTabs
          activeTab={activeTab}
          tabs={visiblePanelTabs}
          onSelectTab={handleSelectTab}
        />
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
          ) : activeTab === "commits" ? (
            <CommitsPanel
              currentRef={currentRef}
              commits={commits}
              isLoading={isCommitsLoading}
              hasMore={hasMoreCommits}
              error={commitsError}
              selectedCommitHash={selectedCommitHash}
              onSelectCommit={onSelectCommit}
              onLoadMore={onLoadMoreCommits}
            />
          ) : activeTab === "pull-request" ? (
            pullRequestPanel
          ) : (
            <SidebarPanelEmpty label={activeTabDefinition.label} />
          )}
        </div>
      </SidebarContent>
      <div className={cn(!isCurrentTab && "hidden")}>{gitActionsPanel}</div>
    </div>
  )
}
