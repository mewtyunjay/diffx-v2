import type { ReactNode } from "react"
import { ChevronDown, ChevronRight, FileText, Folder, FolderOpen } from "lucide-react"

import {
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

import { flattenVisibleTree, type SidebarTreeFolderNode } from "@/components/file-tree/tree-model"

type SidebarFileTreeProps<T> = {
  root: SidebarTreeFolderNode<T>
  expandedPaths: string[]
  selectedPath: string | null
  showRoot?: boolean
  indent?: number
  density?: "compact" | "comfortable"
  getFileIndicatorClassName?: (data: T) => string | null
  renderFileAction?: (data: T) => ReactNode
  onToggleFolder: (path: string) => void
  onSelectFile: (path: string, data: T | undefined) => void
}

export function SidebarFileTree<T>({
  root,
  expandedPaths,
  selectedPath,
  showRoot = true,
  indent = 12,
  density = "comfortable",
  getFileIndicatorClassName,
  renderFileAction,
  onToggleFolder,
  onSelectFile,
}: SidebarFileTreeProps<T>) {
  const expandedPathSet = new Set(expandedPaths)
  const rows = showRoot
    ? flattenVisibleTree(root, expandedPathSet)
    : root.children.flatMap((child) => flattenVisibleTree(child, expandedPathSet, 0))

  return (
    <SidebarMenu>
      {rows.map((row) => {
        const isFile = row.kind === "file"
        const indicatorClassName =
          isFile && row.data && getFileIndicatorClassName
            ? getFileIndicatorClassName(row.data)
            : null
        const fileAction = isFile && row.data && renderFileAction ? renderFileAction(row.data) : null

        return (
          <SidebarMenuItem key={row.path}>
            <SidebarMenuButton
              type="button"
              size={density === "compact" ? "sm" : "default"}
              isActive={isFile && row.path === selectedPath}
              onClick={() => (isFile ? onSelectFile(row.path, row.data) : onToggleFolder(row.path))}
              className={cn(
                "justify-start gap-2 rounded-lg font-normal transition-colors",
                row.depth === 0 && "font-semibold",
                density === "comfortable" ? "h-8 text-sm" : "h-7 text-xs"
              )}
              style={{
                paddingLeft: `${10 + row.depth * indent}px`,
              }}
              title={row.path === "." ? "repo root" : row.path}
            >
              {isFile ? (
                <span aria-hidden="true" className="size-3.5 shrink-0" />
              ) : row.isExpanded ? (
                <ChevronDown className="size-3.5 text-sidebar-foreground/45" />
              ) : (
                <ChevronRight className="size-3.5 text-sidebar-foreground/45" />
              )}
              {isFile ? (
                <FileText className="size-4 shrink-0 text-sidebar-foreground/55" />
              ) : row.isExpanded ? (
                <FolderOpen className="size-4 shrink-0 text-sidebar-primary" />
              ) : (
                <Folder className="size-4 shrink-0 text-sidebar-primary" />
              )}
              {indicatorClassName ? (
                <span
                  aria-hidden="true"
                  className={cn("size-2 shrink-0 rounded-full", indicatorClassName)}
                />
              ) : null}
              <span className="min-w-0 truncate">{row.name}</span>
            </SidebarMenuButton>
            {fileAction ? <SidebarMenuAction asChild>{fileAction}</SidebarMenuAction> : null}
          </SidebarMenuItem>
        )
      })}
    </SidebarMenu>
  )
}
