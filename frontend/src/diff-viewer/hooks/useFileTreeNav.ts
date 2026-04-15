import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import {
  buildSidebarTree,
  collectFolderPaths,
  flattenVisibleTree,
  getAncestorFolderPaths,
  type SidebarTreeFolderNode,
} from "@/components/file-tree/tree-model"
import type { ChangedFileItem } from "@/git/types"

type UseFileTreeNavArgs = {
  files: ChangedFileItem[]
  selectedFilePath: string | null
  repoName: string
  workspaceName: string
}

type UseFileTreeNavResult = {
  tree: SidebarTreeFolderNode<ChangedFileItem>
  expandedPaths: string[]
  handleToggleFolder: (path: string) => void
  selectedFile: ChangedFileItem | null
  prevFile: ChangedFileItem | null
  nextFile: ChangedFileItem | null
  indexOfSelected: number
  totalNavigable: number
}

export function useFileTreeNav({
  files,
  selectedFilePath,
  repoName,
  workspaceName,
}: UseFileTreeNavArgs): UseFileTreeNavResult {
  const tree = useMemo(
    () =>
      buildSidebarTree(
        files.map((file) => ({
          path: file.displayPath,
          data: file,
        })),
        {
          rootName: workspaceName || repoName || "repository",
        }
      ),
    [files, repoName, workspaceName]
  )

  const folderPaths = useMemo(() => collectFolderPaths(tree), [tree])

  const selectedFile = useMemo(
    () => files.find((file) => file.path === selectedFilePath) ?? null,
    [files, selectedFilePath]
  )

  const selectedAncestorPaths = useMemo(
    () => (selectedFile ? getAncestorFolderPaths(selectedFile.displayPath) : [tree.path]),
    [selectedFile, tree.path]
  )

  const [expandedPaths, setExpandedPaths] = useState<string[]>(folderPaths)
  const hasInitialized = useRef(false)

  useEffect(() => {
    const folderPathSet = new Set(folderPaths)

    setExpandedPaths((currentPaths) => {
      const shouldInitialize =
        !hasInitialized.current && (files.length > 0 || folderPaths.length > 1)
      const nextPaths = shouldInitialize
        ? [...folderPaths]
        : currentPaths.filter((path) => folderPathSet.has(path))

      if (shouldInitialize) {
        hasInitialized.current = true
      }

      for (const path of selectedAncestorPaths) {
        if (folderPathSet.has(path) && !nextPaths.includes(path)) {
          nextPaths.push(path)
        }
      }

      return nextPaths
    })
  }, [files.length, folderPaths, selectedAncestorPaths])

  const handleToggleFolder = useCallback((path: string) => {
    setExpandedPaths((currentPaths) =>
      currentPaths.includes(path)
        ? currentPaths.filter((currentPath) => currentPath !== path)
        : [...currentPaths, path]
    )
  }, [])

  const navigableFiles = useMemo(() => {
    const fullyExpandedSet = new Set(folderPaths)
    return flattenVisibleTree(tree, fullyExpandedSet)
      .filter((row) => row.kind === "file" && row.data)
      .map((row) => row.data as ChangedFileItem)
  }, [folderPaths, tree])

  const { indexOfSelected, prevFile, nextFile } = useMemo(() => {
    if (!selectedFile || navigableFiles.length === 0) {
      return { indexOfSelected: -1, prevFile: null, nextFile: null }
    }

    const index = navigableFiles.findIndex((file) => file.path === selectedFile.path)

    if (index === -1) {
      return { indexOfSelected: -1, prevFile: null, nextFile: null }
    }

    return {
      indexOfSelected: index,
      prevFile: index > 0 ? navigableFiles[index - 1] : null,
      nextFile: index < navigableFiles.length - 1 ? navigableFiles[index + 1] : null,
    }
  }, [navigableFiles, selectedFile])

  return {
    tree,
    expandedPaths,
    handleToggleFolder,
    selectedFile,
    prevFile,
    nextFile,
    indexOfSelected,
    totalNavigable: navigableFiles.length,
  }
}
