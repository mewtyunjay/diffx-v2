import { Minus, Plus } from "lucide-react"
import * as React from "react"

import type {
  ChangedFileItem,
  ComparisonMode,
} from "@/git/types"
import { SidebarFileTree } from "@/components/file-tree/SidebarFileTree"
import { fileStatusIndicatorClassNames } from "@/components/file-tree/status-indicator"
import type { SidebarTreeFolderNode } from "@/components/file-tree/tree-model"
import { Button } from "@/components/ui/button"
import { SidebarContent } from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

type FileTreePanelProps = {
  files: ChangedFileItem[]
  tree: SidebarTreeFolderNode<ChangedFileItem>
  expandedPaths: string[]
  onToggleFolder: (path: string) => void
  selectedFile: ChangedFileItem | null
  scopePath: string
  comparisonMode: ComparisonMode
  onSelectFile: (path: string) => void
  stagePendingPaths: string[]
  isBulkStagePending: boolean
  onToggleStage: (file: ChangedFileItem) => void
  onStageAll: () => void
  onUnstageAll: () => void
}

export function FileTreePanel({
  files,
  tree,
  expandedPaths,
  onToggleFolder,
  selectedFile,
  scopePath,
  comparisonMode,
  onSelectFile,
  stagePendingPaths,
  isBulkStagePending,
  onToggleStage,
  onStageAll,
  onUnstageAll,
}: FileTreePanelProps) {
  const stagePendingPathSet = React.useMemo(() => new Set(stagePendingPaths), [stagePendingPaths])

  const canUseGitActions = comparisonMode === "head"
  const showBulkStageActions = scopePath === "."
  const visibleFileCountLabel = `${files.length} changed ${files.length === 1 ? "file" : "files"}`
  const stageAllCount = React.useMemo(
    () => files.filter((file) => file.hasUnstagedChanges).length,
    [files]
  )
  const unstageAllCount = React.useMemo(
    () => files.filter((file) => file.hasStagedChanges).length,
    [files]
  )
  const showUnstageAll = stageAllCount === 0 && unstageAllCount > 0
  const bulkActionLabel = showUnstageAll ? "Unstage All" : "Stage All"
  const bulkActionDisabled =
    !canUseGitActions ||
    isBulkStagePending ||
    (showUnstageAll ? unstageAllCount === 0 : stageAllCount === 0)

  return (
    <SidebarContent>
      <div className="px-2 pb-2 pt-3">
        <div className="mb-2 flex items-center justify-between gap-2 px-1">
          <p className="type-meta font-medium text-sidebar-foreground/72">{visibleFileCountLabel}</p>
          {showBulkStageActions ? (
            <Button
              type="button"
              size="xs"
              variant="outline"
              className={cn(
                "min-w-[5.75rem] border-sidebar-border/70 bg-sidebar/60 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                isBulkStagePending && "disabled:opacity-100"
              )}
              disabled={bulkActionDisabled}
              onClick={showUnstageAll ? onUnstageAll : onStageAll}
            >
              {bulkActionLabel}
            </Button>
          ) : null}
        </div>
        <SidebarFileTree
          root={tree}
          expandedPaths={expandedPaths}
          selectedPath={selectedFile?.displayPath ?? null}
          showRoot={false}
          indent={10}
          density="comfortable"
          getFileIndicatorClassName={(file) => fileStatusIndicatorClassNames[file.status]}
          getFileLanguage={(file) => file.language}
          renderFileAction={(file) => {
            const isPending = stagePendingPathSet.has(file.path)
            const hasAction = file.hasStagedChanges || file.hasUnstagedChanges
            const isDisabled = !canUseGitActions || !hasAction || isPending
            const actionLabel = file.hasStagedChanges ? "Unstage file" : "Stage file"

            return (
              <button
                type="button"
                aria-label={`${actionLabel}: ${file.displayPath}`}
                title={
                  !canUseGitActions
                    ? "Switch comparison back to HEAD to stage files"
                    : actionLabel
                }
                className={cn(
                  "flex size-5 items-center justify-center rounded-md text-sidebar-foreground/75 transition-colors",
                  isDisabled
                    ? "cursor-not-allowed opacity-45"
                    : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              disabled={isDisabled}
              onClick={(event) => {
                event.stopPropagation()
                if (!isDisabled) {
                  onToggleStage(file)
                }
              }}
            >
                {file.hasStagedChanges ? <Minus className="size-3.5" /> : <Plus className="size-3.5" />}
              </button>
            )
          }}
          onToggleFolder={onToggleFolder}
          onSelectFile={(path, file) => {
            if (file) {
              onSelectFile(file.path)
              return
            }

            onSelectFile(path)
          }}
        />
      </div>
    </SidebarContent>
  )
}
