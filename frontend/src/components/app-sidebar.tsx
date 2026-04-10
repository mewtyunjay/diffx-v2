import * as React from "react"
import { FolderTree } from "lucide-react"

import type {
  ChangedFileItem,
  ComparisonMode,
} from "@/git/types"
import { FileTreePanel } from "@/components/sidebar/FileTreePanel"
import { GitActionsPanel } from "@/components/sidebar/GitActionsPanel"
import {
  Sidebar,
  SidebarHeader,
} from "@/components/ui/sidebar"

type AppSidebarProps = React.ComponentProps<typeof Sidebar> & {
  files: ChangedFileItem[]
  repoName: string
  workspaceName: string
  scopePath: string
  comparisonMode: ComparisonMode
  selectedFilePath: string | null
  onSelectFile: (path: string) => void
  hiddenStagedFileCount: number
  stagePendingPaths: string[]
  isBulkStagePending: boolean
  onToggleStage: (file: ChangedFileItem) => void
  onStageAll: () => void
  onUnstageAll: () => void
  commitMessage: string
  isCommitPending: boolean
  onCommitMessageChange: (value: string) => void
  onCommit: () => void
  isPushPending: boolean
  showPushAction: boolean
  onPush: () => void
}

export function AppSidebar({
  files,
  repoName,
  workspaceName,
  scopePath,
  comparisonMode,
  selectedFilePath,
  onSelectFile,
  hiddenStagedFileCount,
  stagePendingPaths,
  isBulkStagePending,
  onToggleStage,
  onStageAll,
  onUnstageAll,
  commitMessage,
  isCommitPending,
  onCommitMessageChange,
  onCommit,
  isPushPending,
  showPushAction,
  onPush,
  ...props
}: AppSidebarProps) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader className="relative h-(--header-height) justify-center gap-0 px-0 py-0">
        <div className="flex h-full items-center px-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-sidebar-border/70 bg-[var(--surface-sidebar-accent)] p-1.5 text-sidebar-primary">
              <FolderTree className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate type-title text-sidebar-foreground">
                {repoName || workspaceName || "repository"}
              </p>
            </div>
          </div>
        </div>
      </SidebarHeader>

      <div className="flex min-h-0 flex-1 flex-col">
        <FileTreePanel
          files={files}
          repoName={repoName}
          workspaceName={workspaceName}
          scopePath={scopePath}
          comparisonMode={comparisonMode}
          selectedFilePath={selectedFilePath}
          onSelectFile={onSelectFile}
          stagePendingPaths={stagePendingPaths}
          isBulkStagePending={isBulkStagePending}
          onToggleStage={onToggleStage}
          onStageAll={onStageAll}
          onUnstageAll={onUnstageAll}
        />

        <GitActionsPanel
          comparisonMode={comparisonMode}
          files={files}
          hiddenStagedFileCount={hiddenStagedFileCount}
          commitMessage={commitMessage}
          isCommitPending={isCommitPending}
          onCommitMessageChange={onCommitMessageChange}
          onCommit={onCommit}
          isPushPending={isPushPending}
          showPushAction={showPushAction}
          onPush={onPush}
        />
      </div>
    </Sidebar>
  )
}
