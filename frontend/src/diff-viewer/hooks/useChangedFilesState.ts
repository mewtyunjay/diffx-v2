import { useCallback, useEffect, useRef, useState } from "react"

import { fetchChangedFiles } from "@/git/api"
import type {
  BranchSyncState,
  ChangedFileItem,
  ChangedFilesResult,
  ComparisonMode,
} from "@/git/types"

type UseChangedFilesStateOptions = {
  onApplyResult?: (result: ChangedFilesResult) => void
}

const defaultBranchSync: BranchSyncState = {
  hasUpstream: false,
  aheadCount: 0,
  behindCount: 0,
}

export function useChangedFilesState({ onApplyResult }: UseChangedFilesStateOptions = {}) {
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>("head")
  const [selectedBaseRef, setSelectedBaseRef] = useState("HEAD")
  const [baseCommit, setBaseCommit] = useState("")
  const [currentRef, setCurrentRef] = useState("HEAD")
  const [branchSync, setBranchSync] = useState<BranchSyncState>(defaultBranchSync)
  const [scopePath, setScopePath] = useState(".")
  const [hiddenStagedFileCount, setHiddenStagedFileCount] = useState(0)
  const [files, setFiles] = useState<ChangedFileItem[]>([])
  const [filesError, setFilesError] = useState<string | null>(null)
  const [isFilesLoading, setIsFilesLoading] = useState(true)
  const [repoName, setRepoName] = useState("")
  const [workspaceName, setWorkspaceName] = useState("")
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null)

  const selectedFilePathRef = useRef<string | null>(null)

  useEffect(() => {
    selectedFilePathRef.current = selectedFilePath
  }, [selectedFilePath])

  const applyChangedFilesResult = useCallback(
    (result: ChangedFilesResult) => {
      const nextSelectedPath =
        selectedFilePathRef.current && result.files.some((file) => file.path === selectedFilePathRef.current)
          ? selectedFilePathRef.current
          : result.files[0]?.path ?? null

      setComparisonMode(result.mode)
      setBaseCommit(result.baseCommit)
      setCurrentRef(result.currentRef)
      setBranchSync(result.branchSync)
      setRepoName(result.repoName)
      setScopePath(result.scopePath)
      setWorkspaceName(result.workspaceName)
      setHiddenStagedFileCount(result.hiddenStagedFileCount)
      setFiles(result.files)
      setFilesError(null)
      setSelectedFilePath(nextSelectedPath)

      onApplyResult?.(result)
    },
    [onApplyResult]
  )

  const refreshChangedFiles = useCallback(
    async (signal?: AbortSignal) => {
      const result = await fetchChangedFiles(selectedBaseRef, signal)
      applyChangedFilesResult(result)
      return result
    },
    [applyChangedFilesResult, selectedBaseRef]
  )

  useEffect(() => {
    const controller = new AbortController()

    fetchChangedFiles(selectedBaseRef, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) {
          return
        }

        applyChangedFilesResult(result)
      })
      .catch((error: Error) => {
        if (controller.signal.aborted) {
          return
        }

        setComparisonMode("head")
        setBaseCommit("")
        setCurrentRef("HEAD")
        setBranchSync(defaultBranchSync)
        setScopePath(".")
        setHiddenStagedFileCount(0)
        setFiles([])
        setFilesError(error.message)
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsFilesLoading(false)
        }
      })

    return () => controller.abort()
  }, [applyChangedFilesResult, selectedBaseRef])

  const handleSelectBaseRef = useCallback((nextBaseRef: string) => {
    setSelectedBaseRef(nextBaseRef)
    setIsFilesLoading(true)
  }, [])

  return {
    applyChangedFilesResult,
    baseCommit,
    branchSync,
    comparisonMode,
    currentRef,
    files,
    filesError,
    handleSelectBaseRef,
    hiddenStagedFileCount,
    isFilesLoading,
    refreshChangedFiles,
    repoName,
    scopePath,
    selectedBaseRef,
    selectedFilePath,
    setFilesError,
    setSelectedFilePath,
    workspaceName,
  }
}
