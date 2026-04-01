import * as React from "react"
import { FolderTree } from "lucide-react"

import type { ChangedFileItem, ChangedFileStatus } from "@/app/changed-files/api"
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
  selectedFilePath,
  onSelectFile,
  ...props
}: AppSidebarProps) {
  const tree = React.useMemo(
    () =>
      buildSidebarTree(
        files.map((file) => ({
          path: file.path,
          data: file,
        })),
        {
          rootName: "diffx-v2",
        }
      ),
    [files]
  )
  const folderPaths = React.useMemo(() => collectFolderPaths(tree), [tree])
  const selectedAncestorPaths = React.useMemo(
    () => (selectedFilePath ? getAncestorFolderPaths(selectedFilePath) : [tree.path]),
    [selectedFilePath, tree.path]
  )
  const [expandedPaths, setExpandedPaths] = React.useState<string[]>(folderPaths)
  const hasInitializedExpandedState = React.useRef(false)

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
              Changed files
            </p>
            <p className="mt-1 text-sm font-semibold text-sidebar-foreground">diffx-v2</p>
            <p className="mt-1 text-xs leading-5 text-sidebar-foreground/60">
              {files.length} changed {files.length === 1 ? "file" : "files"} nested from repo
              root.
            </p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="pb-4">
        <div className="p-2">
          <SidebarFileTree
            root={tree}
            expandedPaths={expandedPaths}
            selectedPath={selectedFilePath}
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
