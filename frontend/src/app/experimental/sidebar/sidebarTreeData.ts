export type ExperimentalTreeNode =
  | {
      kind: "folder"
      name: string
      path: string
      children: ExperimentalTreeNode[]
    }
  | {
      kind: "file"
      name: string
      path: string
    }

export type ExperimentalTreeRow = {
  kind: ExperimentalTreeNode["kind"]
  name: string
  path: string
  depth: number
  isExpanded: boolean
}

function file(path: string): ExperimentalTreeNode {
  return {
    kind: "file",
    name: path.split("/").at(-1) ?? path,
    path,
  }
}

function folder(path: string, children: ExperimentalTreeNode[]): ExperimentalTreeNode {
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

export const experimentalSidebarTree = folder(".", [
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

export function flattenVisibleTree(
  node: ExperimentalTreeNode,
  expandedPaths: Set<string>,
  depth = 0
): ExperimentalTreeRow[] {
  if (node.kind === "file") {
    return [
      {
        kind: node.kind,
        name: node.name,
        path: node.path,
        depth,
        isExpanded: false,
      },
    ]
  }

  const isExpanded = expandedPaths.has(node.path)
  const rows: ExperimentalTreeRow[] = [
    {
      kind: node.kind,
      name: node.name,
      path: node.path,
      depth,
      isExpanded,
    },
  ]

  if (!isExpanded) {
    return rows
  }

  for (const child of node.children) {
    rows.push(...flattenVisibleTree(child, expandedPaths, depth + 1))
  }

  return rows
}
