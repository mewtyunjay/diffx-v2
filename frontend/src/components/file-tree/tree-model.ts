export type SidebarTreeFolderNode<T> = {
  kind: "folder"
  name: string
  path: string
  children: SidebarTreeNode<T>[]
}

export type SidebarTreeFileNode<T> = {
  kind: "file"
  name: string
  path: string
  data: T
}

export type SidebarTreeNode<T> = SidebarTreeFolderNode<T> | SidebarTreeFileNode<T>

export type SidebarTreeRow<T> = {
  kind: SidebarTreeNode<T>["kind"]
  name: string
  path: string
  depth: number
  isExpanded: boolean
  data?: T
}

type TreeLeafInput<T> = {
  path: string
  data: T
}

type BuildSidebarTreeOptions = {
  rootName: string
  rootPath?: string
}

export function buildSidebarTree<T>(
  leaves: TreeLeafInput<T>[],
  { rootName, rootPath = "." }: BuildSidebarTreeOptions
) {
  const root: SidebarTreeFolderNode<T> = {
    kind: "folder",
    name: rootName,
    path: rootPath,
    children: [],
  }
  const folders = new Map<string, SidebarTreeFolderNode<T>>([[rootPath, root]])

  for (const leaf of leaves) {
    const segments = leaf.path.split("/").filter(Boolean)
    const fileName = segments.at(-1) ?? leaf.path
    let parent = root
    let currentPath = ""

    for (const segment of segments.slice(0, -1)) {
      currentPath = currentPath ? `${currentPath}/${segment}` : segment
      let folder = folders.get(currentPath)

      if (!folder) {
        folder = {
          kind: "folder",
          name: segment,
          path: currentPath,
          children: [],
        }
        folders.set(currentPath, folder)
        parent.children.push(folder)
      }

      parent = folder
    }

    parent.children.push({
      kind: "file",
      name: fileName,
      path: leaf.path,
      data: leaf.data,
    })
  }

  sortSidebarTree(root)

  return root
}

function sortSidebarTree<T>(node: SidebarTreeFolderNode<T>) {
  node.children.sort((left, right) => {
    if (left.kind !== right.kind) {
      return left.kind === "folder" ? -1 : 1
    }

    return left.name.localeCompare(right.name)
  })

  for (const child of node.children) {
    if (child.kind === "folder") {
      sortSidebarTree(child)
    }
  }
}

export function flattenVisibleTree<T>(
  node: SidebarTreeNode<T>,
  expandedPaths: Set<string>,
  depth = 0
): SidebarTreeRow<T>[] {
  if (node.kind === "file") {
    return [
      {
        kind: node.kind,
        name: node.name,
        path: node.path,
        depth,
        isExpanded: false,
        data: node.data,
      },
    ]
  }

  const isExpanded = expandedPaths.has(node.path)
  const rows: SidebarTreeRow<T>[] = [
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

export function collectFolderPaths<T>(node: SidebarTreeFolderNode<T>) {
  const paths = [node.path]

  for (const child of node.children) {
    if (child.kind === "folder") {
      paths.push(...collectFolderPaths(child))
    }
  }

  return paths
}

export function getAncestorFolderPaths(path: string, rootPath = ".") {
  const segments = path.split("/").filter(Boolean)
  const paths = [rootPath]
  let currentPath = ""

  for (const segment of segments.slice(0, -1)) {
    currentPath = currentPath ? `${currentPath}/${segment}` : segment
    paths.push(currentPath)
  }

  return paths
}
