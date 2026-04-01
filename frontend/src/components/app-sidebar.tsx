import * as React from "react"
import { FolderTree } from "lucide-react"

import type { BranchOption, ChangedFileItem, ChangedFileStatus } from "@/app/changed-files/api"
import { SidebarFileTree } from "@/components/file-tree/SidebarFileTree"
import {
  buildSidebarTree,
  collectFolderPaths,
  getAncestorFolderPaths,
} from "@/components/file-tree/tree-model"
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
} from "@/components/ui/sidebar"

type AppSidebarProps = React.ComponentProps<typeof Sidebar> & {
  files: ChangedFileItem[]
  workspaceName: string
  scopePath: string
  branches: BranchOption[]
  selectedBaseRef: string
  onSelectBaseRef: (path: string) => void
  isBranchesLoading: boolean
  branchesError: string | null
  selectedFilePath: string | null
  onSelectFile: (path: string) => void
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
  selectedBaseRef,
  onSelectBaseRef,
  isBranchesLoading,
  branchesError,
  selectedFilePath,
  onSelectFile,
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
  const localBranches = React.useMemo(
    () => branches.filter((branch) => branch.kind === "local"),
    [branches]
  )
  const remoteBranches = React.useMemo(
    () => branches.filter((branch) => branch.kind === "remote"),
    [branches]
  )

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
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-sidebar-foreground/65">
              Workspace
            </p>
            <p className="mt-1 text-sm font-semibold text-sidebar-foreground">{workspaceName}</p>
            <p className="mt-1 text-xs leading-5 text-sidebar-foreground/60">
              {files.length} changed {files.length === 1 ? "file" : "files"} in{" "}
              {scopePath === "." ? "this repo root" : "this directory"}.
            </p>
            <div className="mt-3 max-w-full">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-sidebar-foreground/65">
                Compare with
              </p>
              <div className="mt-2 rounded-xl border border-sidebar-border/70 bg-sidebar-accent/40 px-3 py-2">
                <select
                  value={selectedBaseRef}
                  onChange={(event) => onSelectBaseRef(event.target.value)}
                  disabled={isBranchesLoading || branchesError != null}
                  aria-label="Select diff base branch"
                  className="w-full truncate bg-transparent text-sm font-medium text-sidebar-foreground outline-none disabled:cursor-not-allowed disabled:text-sidebar-foreground/50"
                >
                  <option value="HEAD">HEAD</option>
                  {localBranches.length > 0 ? (
                    <optgroup label="Local branches">
                      {localBranches.map((branch) => (
                        <option key={branch.name} value={branch.name}>
                          {branch.name}
                          {branch.isCurrent ? " (current)" : ""}
                        </option>
                      ))}
                    </optgroup>
                  ) : null}
                  {remoteBranches.length > 0 ? (
                    <optgroup label="Remote branches">
                      {remoteBranches.map((branch) => (
                        <option key={branch.name} value={branch.name}>
                          {branch.name}
                        </option>
                      ))}
                    </optgroup>
                  ) : null}
                </select>
              </div>
              {branchesError ? (
                <p className="mt-2 text-xs leading-5 text-rose-300">{branchesError}</p>
              ) : null}
            </div>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="pb-4">
        <div className="p-2">
          <SidebarFileTree
            root={tree}
            expandedPaths={expandedPaths}
            selectedPath={selectedFile?.displayPath ?? null}
            showRoot={false}
            indent={12}
            density="comfortable"
            getFileIndicatorClassName={(file) => statusClassNames[file.status]}
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
    </Sidebar>
  )
}
