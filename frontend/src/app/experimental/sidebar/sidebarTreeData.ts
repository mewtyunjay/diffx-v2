import type {
  SidebarTreeFolderNode,
  SidebarTreeNode,
} from "@/components/file-tree/tree-model"

function file(path: string): SidebarTreeNode<never> {
  return {
    kind: "file",
    name: path.split("/").at(-1) ?? path,
    path,
    data: undefined as never,
  }
}

function folder(path: string, children: SidebarTreeNode<never>[]): SidebarTreeFolderNode<never> {
  return {
    kind: "folder",
    name: path === "." ? "diffx-v2" : path.split("/").at(-1) ?? path,
    path,
    children,
  }
}

export const DEFAULT_SELECTED_FILE_PATH = "frontend/src/features/gantt/hooks/useExport.dom.test.tsx"

export const DEFAULT_EXPANDED_PATHS = [
  ".",
  "frontend",
  "frontend/src",
  "frontend/src/features",
  "frontend/src/features/gantt",
  "frontend/src/features/gantt/hooks",
  "frontend/src/features/gantt/toolbar",
  "frontend/src/features/gantt/schedule",
  "frontend/src/features/gantt/schedule/services",
  "frontend/src/features/gantt/pages",
  "internal",
  "internal/logging",
  "internal/schedule",
  "internal/schedule/http",
  "internal/schedule/io",
  "internal/schedule/io/xer",
  "internal/schedule/pg",
] as const

export const experimentalSidebarTree: SidebarTreeFolderNode<never> = folder(".", [
  folder("frontend", [
    folder("frontend/src", [
      folder("frontend/src/features", [
        folder("frontend/src/features/gantt", [
          folder("frontend/src/features/gantt/hooks", [
            file("frontend/src/features/gantt/hooks/useExport.dom.test.tsx"),
            file("frontend/src/features/gantt/hooks/useExport.ts"),
          ]),
          folder("frontend/src/features/gantt/toolbar", [
            file("frontend/src/features/gantt/toolbar/ExportDropdown.tsx"),
          ]),
          folder("frontend/src/features/gantt/schedule", [
            folder("frontend/src/features/gantt/schedule/services", [
              file("frontend/src/features/gantt/schedule/services/scheduleService.ts"),
            ]),
          ]),
          folder("frontend/src/features/gantt/pages", [
            file("frontend/src/features/gantt/pages/Schedule.tsx"),
          ]),
        ]),
      ]),
    ]),
  ]),
  folder("internal", [
    folder("internal/logging", [file("internal/logging/log.go")]),
    folder("internal/schedule", [
      file("internal/schedule/export.go"),
      folder("internal/schedule/http", [
        file("internal/schedule/http/handler.go"),
        file("internal/schedule/http/routes.go"),
      ]),
      folder("internal/schedule/io", [
        folder("internal/schedule/io/xer", [
          file("internal/schedule/io/xer/export_test.go"),
          file("internal/schedule/io/xer/export.go"),
        ]),
      ]),
      folder("internal/schedule/pg", [file("internal/schedule/pg/xer_export.go")]),
      file("internal/schedule/service.go"),
    ]),
  ]),
])
