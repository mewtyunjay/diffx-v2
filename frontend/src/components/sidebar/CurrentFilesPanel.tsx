import { Folder, FolderOpen, Minus, Plus, Search, X } from "lucide-react"
import * as React from "react"

import type { ChangedFileItem, ComparisonMode } from "@/git/types"
import { SidebarFileTree } from "@/components/file-tree/SidebarFileTree"
import { fileStatusIndicatorClassNames } from "@/components/file-tree/status-indicator"
import type { SidebarTreeFolderNode } from "@/components/file-tree/tree-model"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

function isPartiallyStaged(file: ChangedFileItem) {
  return file.hasStagedChanges && file.hasUnstagedChanges
}

function PartialStageIcon() {
  return (
    <span
      aria-hidden="true"
      className="relative inline-flex h-4 w-3.5 shrink-0 items-center justify-center"
    >
      <Plus className="absolute left-1/2 top-0 size-2.5 -translate-x-1/2" strokeWidth={2.5} />
      <Minus className="absolute bottom-0 left-1/2 size-2.5 -translate-x-1/2" strokeWidth={2.5} />
    </span>
  )
}

function StageActionIcon({ file }: { file: ChangedFileItem }) {
  if (isPartiallyStaged(file)) {
    return <PartialStageIcon />
  }

  return file.hasStagedChanges ? <Minus className="size-3.5" /> : <Plus className="size-3.5" />
}

function getStageActionLabel(file: ChangedFileItem) {
  if (isPartiallyStaged(file)) {
    return "Partially staged. Unstage file"
  }

  return file.hasStagedChanges ? "Unstage file" : "Stage file"
}

type CurrentFilesPanelProps = {
  files: ChangedFileItem[]
  totalFileCount: number
  searchQuery: string
  onSearchQueryChange: (query: string) => void
  searchInputRef: React.RefObject<HTMLInputElement | null>
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

type CurrentFilesPanelControlsProps = {
  areAllFoldersExpanded: boolean
  bulkActionDisabled: boolean
  bulkActionLabel: string
  folderToggleLabel: string
  hasExpandableFolders: boolean
  isBulkStagePending: boolean
  searchInputRef: React.RefObject<HTMLInputElement | null>
  searchQuery: string
  showBulkStageActions: boolean
  visibleFileCountLabel: string
  onBulkAction: () => void
  onSearchQueryChange: (query: string) => void
  onToggleAllFolders: () => void
}

function CurrentFilesPanelControls({
  areAllFoldersExpanded,
  bulkActionDisabled,
  bulkActionLabel,
  folderToggleLabel,
  hasExpandableFolders,
  isBulkStagePending,
  searchInputRef,
  searchQuery,
  showBulkStageActions,
  visibleFileCountLabel,
  onBulkAction,
  onSearchQueryChange,
  onToggleAllFolders,
}: CurrentFilesPanelControlsProps) {
  return (
    <div className="sticky top-0 z-20 -mx-2 mb-2 border-b border-sidebar-border/50 bg-sidebar px-2 pb-2">
      <div className="flex items-center justify-between gap-2 px-1">
        <p className="whitespace-nowrap type-meta font-medium text-sidebar-foreground/72">
          {visibleFileCountLabel}
        </p>
        <div className="flex shrink-0 items-center gap-1">
          {hasExpandableFolders ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="icon-xs"
                  variant="ghost"
                  className="text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  aria-label={folderToggleLabel}
                  onClick={onToggleAllFolders}
                >
                  {areAllFoldersExpanded ? (
                    <Folder className="size-3.5" />
                  ) : (
                    <FolderOpen className="size-3.5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={6}>
                {folderToggleLabel}
              </TooltipContent>
            </Tooltip>
          ) : null}
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
              onClick={onBulkAction}
            >
              {bulkActionLabel}
            </Button>
          ) : null}
        </div>
      </div>
      <div className="relative mt-2">
        <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-sidebar-foreground/45" />
        <input
          ref={searchInputRef}
          type="search"
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Escape") {
              return
            }

            event.preventDefault()
            if (searchQuery) {
              onSearchQueryChange("")
              return
            }

            searchInputRef.current?.blur()
          }}
          placeholder="Search files"
          aria-label="Search changed files"
          className="h-8 w-full rounded-md border border-sidebar-border/70 bg-sidebar/70 pl-7 pr-7 type-meta text-sidebar-foreground outline-none transition-colors placeholder:text-sidebar-foreground/45 focus:border-sidebar-ring/70 focus:bg-sidebar"
        />
        {searchQuery ? (
          <button
            type="button"
            className="absolute right-1.5 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded-md text-sidebar-foreground/55 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            aria-label="Clear file search"
            onClick={() => {
              onSearchQueryChange("")
              searchInputRef.current?.focus()
            }}
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </div>
    </div>
  )
}

export function CurrentFilesPanel({
  files,
  totalFileCount,
  searchQuery,
  onSearchQueryChange,
  searchInputRef,
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
}: CurrentFilesPanelProps) {
  const stagePendingPathSet = React.useMemo(() => new Set(stagePendingPaths), [stagePendingPaths])
  const canUseGitActions = comparisonMode === "head"
  const showBulkStageActions = scopePath === "."
  const isSearching = searchQuery.trim().length > 0
  const changedFileLabel = totalFileCount === 1 ? "file" : "files"
  const visibleFileCountLabel = isSearching
    ? `${files.length} of ${totalFileCount} changed ${changedFileLabel}`
    : `${totalFileCount} changed ${changedFileLabel}`
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
  const folderToggleLabel = areAllFoldersExpanded ? "Collapse all folders" : "Expand all folders"
  const handleBulkAction = showUnstageAll ? onUnstageAll : onStageAll

  return (
    <>
      <CurrentFilesPanelControls
        areAllFoldersExpanded={areAllFoldersExpanded}
        bulkActionDisabled={bulkActionDisabled}
        bulkActionLabel={bulkActionLabel}
        folderToggleLabel={folderToggleLabel}
        hasExpandableFolders={hasExpandableFolders}
        isBulkStagePending={isBulkStagePending}
        searchInputRef={searchInputRef}
        searchQuery={searchQuery}
        showBulkStageActions={showBulkStageActions}
        visibleFileCountLabel={visibleFileCountLabel}
        onBulkAction={handleBulkAction}
        onSearchQueryChange={onSearchQueryChange}
        onToggleAllFolders={onToggleAllFolders}
      />
      <SidebarFileTree
        root={tree}
        expandedPaths={expandedPaths}
        selectedPath={selectedFile?.displayPath ?? null}
        showRoot={false}
        indent={10}
        density="comfortable"
        getFileIndicatorClassName={(file) => fileStatusIndicatorClassNames[file.status]}
        getFileLanguage={(file) => file.language}
        renderFileAction={
          isMergeInProgress
            ? undefined
            : (file) => {
                const isPending = stagePendingPathSet.has(file.path)
                const hasAction = file.hasStagedChanges || file.hasUnstagedChanges
                const isDisabled = !canUseGitActions || !hasAction || isPending
                const actionLabel = getStageActionLabel(file)

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
                    <StageActionIcon file={file} />
                  </button>
                )
              }
        }
        onToggleFolder={onToggleFolder}
        onSelectFile={(path, file) => {
          if (file) {
            onSelectFile(file.path)
            return
          }

          onSelectFile(path)
        }}
      />
    </>
  )
}
