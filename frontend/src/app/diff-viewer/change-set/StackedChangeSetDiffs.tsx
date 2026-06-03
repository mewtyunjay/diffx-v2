import { useCallback, useState } from "react"

import type { ChangedFileItem } from "@/git/types"
import type { ChangeSetFileDiffLoader } from "@/app/diff-viewer/change-set/types"
import {
  createStackedDiffKey,
  useStackedChangeSetDiffs,
} from "@/app/diff-viewer/change-set/useStackedChangeSetDiffs"
import { StackedDiffFileSection } from "@/app/diff-viewer/change-set/StackedDiffFileSection"

type StackedChangeSetDiffsProps = {
  expandAll: boolean
  files: ChangedFileItem[]
  loadFileDiff: ChangeSetFileDiffLoader
  scopePath: string
  sourceKey: string
  viewMode: "split" | "unified"
}

export function StackedChangeSetDiffs({
  expandAll,
  files,
  loadFileDiff,
  scopePath,
  sourceKey,
  viewMode,
}: StackedChangeSetDiffsProps) {
  const [viewedFileKeys, setViewedFileKeys] = useState<Record<string, boolean>>({})
  const { diffStates, ensureDiff } = useStackedChangeSetDiffs({
    files,
    loadFileDiff,
    sourceKey,
  })

  const handleViewedChange = useCallback((key: string, viewed: boolean) => {
    setViewedFileKeys((current) => ({
      ...current,
      [key]: viewed,
    }))
  }, [])

  if (files.length === 0) {
    return (
      <div className="flex min-h-64 items-center justify-center px-6 text-center type-meta text-muted-foreground">
        No changed files.
      </div>
    )
  }

  return (
    <div className="min-w-0">
      {files.map((file) => {
        const key = createStackedDiffKey(sourceKey, file)

        return (
          <StackedDiffFileSection
            key={key}
            expandAll={expandAll}
            file={file}
            state={diffStates[key] ?? { status: "idle" }}
            isViewed={viewedFileKeys[key] === true}
            scopePath={scopePath}
            viewMode={viewMode}
            onViewedChange={(viewed) => handleViewedChange(key, viewed)}
            onVisible={ensureDiff}
          />
        )
      })}
    </div>
  )
}
