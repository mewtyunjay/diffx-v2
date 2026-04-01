import { ChevronDown, ChevronRight, FileText, Folder, FolderOpen } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

import {
  type ExperimentalTreeNode,
  flattenVisibleTree,
} from "@/app/experimental/sidebar/sidebarTreeData"

type ExperimentalSidebarTreeProps = {
  root: ExperimentalTreeNode
  expandedPaths: string[]
  selectedPath: string
  indent: number
  density: "compact" | "comfortable"
  onToggleFolder: (path: string) => void
  onSelectFile: (path: string) => void
}

export function ExperimentalSidebarTree({
  root,
  expandedPaths,
  selectedPath,
  indent,
  density,
  onToggleFolder,
  onSelectFile,
}: ExperimentalSidebarTreeProps) {
  const rows = flattenVisibleTree(root, new Set(expandedPaths))

  return (
    <SidebarMenu>
      {rows.map((row) => {
        const isFile = row.kind === "file"

        return (
          <SidebarMenuItem key={row.path}>
            <SidebarMenuButton
              type="button"
              size={density === "compact" ? "sm" : "default"}
              isActive={isFile && row.path === selectedPath}
              onClick={() => (isFile ? onSelectFile(row.path) : onToggleFolder(row.path))}
              className={cn(
                "justify-start gap-2 rounded-lg font-normal transition-colors",
                row.depth === 0 && "font-semibold",
                density === "comfortable" ? "h-8 text-[0.84rem]" : "h-7 text-xs"
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
                <FileText className="size-4 text-sidebar-foreground/55" />
              ) : row.isExpanded ? (
                <FolderOpen className="size-4 text-sidebar-primary" />
              ) : (
                <Folder className="size-4 text-sidebar-primary" />
              )}
              <span className="truncate">{row.name}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        )
      })}
    </SidebarMenu>
  )
}
