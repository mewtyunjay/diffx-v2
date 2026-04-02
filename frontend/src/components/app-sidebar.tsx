import * as React from "react"
import { FolderTree, LoaderCircle, Minus, Plus } from "lucide-react"

import { BranchPicker } from "@/app/diff-viewer/BranchPicker"
import type {
  BranchOption,
  ChangedFileItem,
  ChangedFileStatus,
  ComparisonMode,
} from "@/app/changed-files/api"
import { SidebarFileTree } from "@/components/file-tree/SidebarFileTree"
import {
  buildSidebarTree,
  collectFolderPaths,
  getAncestorFolderPaths,
} from "@/components/file-tree/tree-model"
import { Button } from "@/components/ui/button"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

type SidebarNotice = {
  tone: "success" | "error"
  message: string
}

type AppSidebarProps = React.ComponentProps<typeof Sidebar> & {
  files: ChangedFileItem[]
  workspaceName: string
  scopePath: string
  branches: BranchOption[]
  comparisonMode: ComparisonMode
  selectedBaseRef: string
  onSelectBaseRef: (path: string) => void
  isBranchesLoading: boolean
  branchesError: string | null
  selectedFilePath: string | null
  onSelectFile: (path: string) => void
  hiddenStagedFileCount: number
  stagePendingPaths: string[]
  onToggleStage: (file: ChangedFileItem) => void
  isCommitComposerOpen: boolean
  commitMessage: string
  commitError: string | null
  isCommitPending: boolean
  onOpenCommitComposer: () => void
  onCloseCommitComposer: () => void
  onCommitMessageChange: (value: string) => void
  onCommit: () => void
  isPushPending: boolean
  onPush: () => void
  notice: SidebarNotice | null
}

const statusClassNames: Record<ChangedFileStatus, string> = {
  modified: "bg-amber-400",
  added: "bg-emerald-400",
  deleted: "bg-rose-400",
  renamed: "bg-sky-400",
}

export function AppSidebar({
  files,
  workspaceName,
  scopePath,
  branches,
  comparisonMode,
  selectedBaseRef,
  onSelectBaseRef,
  isBranchesLoading,
  branchesError,
  selectedFilePath,
  onSelectFile,
  hiddenStagedFileCount,
  stagePendingPaths,
  onToggleStage,
  isCommitComposerOpen,
  commitMessage,
  commitError,
  isCommitPending,
  onOpenCommitComposer,
  onCloseCommitComposer,
  onCommitMessageChange,
  onCommit,
  isPushPending,
  onPush,
  notice,
  ...props
}: AppSidebarProps) {
  const selectedFile = React.useMemo(
    () => files.find((file) => file.path === selectedFilePath) ?? null,
    [files, selectedFilePath]
  )
  const tree = React.useMemo(
    () =>
      buildSidebarTree(
        files.map((file) => ({
          path: file.displayPath,
          data: file,
        })),
        {
          rootName: workspaceName,
        }
      ),
    [files, workspaceName]
  )
  const folderPaths = React.useMemo(() => collectFolderPaths(tree), [tree])
  const selectedAncestorPaths = React.useMemo(
    () => (selectedFile ? getAncestorFolderPaths(selectedFile.displayPath) : [tree.path]),
    [selectedFile, tree.path]
  )
  const [expandedPaths, setExpandedPaths] = React.useState<string[]>(folderPaths)
  const hasInitializedExpandedState = React.useRef(false)
  const stagePendingPathSet = React.useMemo(() => new Set(stagePendingPaths), [stagePendingPaths])

  const stagedVisibleCount = React.useMemo(
    () => files.filter((file) => file.hasStagedChanges).length,
    [files]
  )
  const totalStagedCount = stagedVisibleCount + hiddenStagedFileCount
  const canUseGitActions = comparisonMode === "head"
  const canCommit = canUseGitActions && stagedVisibleCount > 0 && hiddenStagedFileCount === 0
  const commitButtonLabel =
    stagedVisibleCount === 1 ? "Commit 1 staged file" : `Commit ${stagedVisibleCount} staged files`

  React.useEffect(() => {
    const folderPathSet = new Set(folderPaths)

    setExpandedPaths((currentPaths) => {
      const shouldInitializeAll =
        !hasInitializedExpandedState.current && (files.length > 0 || folderPaths.length > 1)
      const nextPaths = shouldInitializeAll
        ? [...folderPaths]
        : currentPaths.filter((path) => folderPathSet.has(path))

      if (shouldInitializeAll) {
        hasInitializedExpandedState.current = true
      }

      for (const path of selectedAncestorPaths) {
        if (folderPathSet.has(path) && !nextPaths.includes(path)) {
          nextPaths.push(path)
        }
      }

      return [...nextPaths]
    })
  }, [files.length, folderPaths, selectedAncestorPaths])

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader className="gap-3 border-b border-sidebar-border/70 p-3">
        <div className="flex items-start gap-3">
          <div className="rounded-xl border border-sidebar-border/70 bg-sidebar-accent/60 p-2 text-sidebar-primary">
            <FolderTree className="size-4" />
          </div>
          <div className="min-w-0">
            <p className="type-overline text-sidebar-foreground/65">
              Workspace
            </p>
            <p className="mt-1 type-title text-sidebar-foreground">{workspaceName}</p>
            <p className="measure-readable mt-1 type-meta text-sidebar-foreground/60">
              {files.length} changed {files.length === 1 ? "file" : "files"} in{" "}
              {scopePath === "." ? "this repo root" : "this directory"}.
            </p>
            <div className="mt-3 max-w-full">
              <div className="flex items-center gap-2.5">
                <p className="shrink-0 text-[0.75rem] leading-none font-medium uppercase tracking-[0.12em] text-sidebar-foreground/65">
                  Base
                </p>
                <div className="min-w-0 flex-1">
                  <BranchPicker
                    branches={branches}
                    selectedBaseRef={selectedBaseRef}
                    onSelectBaseRef={onSelectBaseRef}
                    disabled={isBranchesLoading || branchesError != null}
                  />
                </div>
              </div>
              {branchesError ? (
                <p className="measure-readable mt-2 type-meta text-rose-300">{branchesError}</p>
              ) : null}
            </div>
          </div>
        </div>
      </SidebarHeader>

      <div className="relative flex min-h-0 flex-1 flex-col">
        <SidebarContent className="pb-32">
          <div className="p-2">
            <SidebarFileTree
              root={tree}
              expandedPaths={expandedPaths}
              selectedPath={selectedFile?.displayPath ?? null}
              showRoot={false}
              indent={10}
              density="comfortable"
              getFileIndicatorClassName={(file) => statusClassNames[file.status]}
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
                    {isPending ? (
                      <LoaderCircle className="size-3.5 animate-spin" />
                    ) : file.hasStagedChanges ? (
                      <Minus className="size-3.5" />
                    ) : (
                      <Plus className="size-3.5" />
                    )}
                  </button>
                )
              }}
              onToggleFolder={(path) =>
                setExpandedPaths((currentPaths) =>
                  currentPaths.includes(path)
                    ? currentPaths.filter((currentPath) => currentPath !== path)
                    : [...currentPaths, path]
                )
              }
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

        <SidebarFooter className="border-t border-sidebar-border/70 bg-sidebar/95 p-3 backdrop-blur">
          <div className="space-y-3">
            <div>
              <p className="type-overline text-sidebar-foreground/65">
                Git actions
              </p>
              <p className="mt-1 type-title font-medium text-sidebar-foreground type-data">
                {totalStagedCount === 0
                  ? "No staged changes"
                  : `${totalStagedCount} staged ${totalStagedCount === 1 ? "file" : "files"}`}
              </p>
              {comparisonMode !== "head" ? (
                <p className="measure-readable mt-1 type-meta text-sidebar-foreground/60">
                  Switch back to HEAD to stage files, create commits, or push the current branch.
                </p>
              ) : hiddenStagedFileCount > 0 ? (
                <p className="measure-readable mt-1 type-meta text-amber-200">
                  {hiddenStagedFileCount} staged {hiddenStagedFileCount === 1 ? "file is" : "files are"} outside
                  this scoped view. Open the repo root to commit them safely.
                </p>
              ) : (
                <p className="measure-readable mt-1 type-meta text-sidebar-foreground/60">
                  Use + or − beside each file to control the real git index.
                </p>
              )}
            </div>

            {notice ? (
              <p
                className={cn(
                  "rounded-lg border px-3 py-2 type-meta",
                  notice.tone === "success"
                    ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
                    : "border-rose-400/30 bg-rose-500/10 text-rose-100"
                )}
              >
                {notice.message}
              </p>
            ) : null}

            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                className="flex-1"
                disabled={!canCommit || isCommitPending || isPushPending}
                onClick={onOpenCommitComposer}
              >
                {isCommitPending ? <LoaderCircle className="animate-spin" /> : null}
                {commitButtonLabel}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="flex-1"
                disabled={!canUseGitActions || isCommitPending || isPushPending}
                onClick={onPush}
              >
                {isPushPending ? <LoaderCircle className="animate-spin" /> : null}
                Push
              </Button>
            </div>
          </div>
        </SidebarFooter>

        {isCommitComposerOpen ? (
          <div className="absolute inset-x-3 bottom-3 z-20 overflow-hidden rounded-2xl border border-sidebar-border/80 bg-sidebar shadow-2xl">
            <div className="border-b border-sidebar-border/70 px-4 py-3">
              <p className="type-title text-sidebar-foreground">Create commit</p>
              <p className="measure-readable mt-1 type-meta text-sidebar-foreground/60">
                Only the staged files in this workspace scope will be committed.
              </p>
            </div>
            <div className="px-4 py-4">
              <textarea
                value={commitMessage}
                onChange={(event) => onCommitMessageChange(event.target.value)}
                placeholder="Write a clear commit message..."
                className="min-h-28 w-full resize-y rounded-xl border border-sidebar-border/70 bg-sidebar-accent/35 px-3 py-3 type-body text-sidebar-foreground outline-none placeholder:text-sidebar-foreground/45"
              />
              {commitError ? (
                <p className="measure-readable mt-2 type-meta text-rose-300">{commitError}</p>
              ) : (
                <p className="measure-readable mt-2 type-meta text-sidebar-foreground/55">
                  Multi-line messages are supported. The push action stays separate.
                </p>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-sidebar-border/70 px-4 py-3">
              <Button type="button" size="sm" variant="ghost" onClick={onCloseCommitComposer}>
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={isCommitPending || !commitMessage.trim() || !canCommit}
                onClick={onCommit}
              >
                {isCommitPending ? <LoaderCircle className="animate-spin" /> : null}
                Commit
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </Sidebar>
  )
}
