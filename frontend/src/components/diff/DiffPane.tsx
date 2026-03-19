import { FileDiff } from "@pierre/diffs/react"
import { useMemo } from "react"

import type { PreparedFileDiffResult } from "@/components/diff/prepareDiff"

const DIFF_EXPANSION_LINE_COUNT = 20

const FAST_INLINE_DIFF_MAX_LINE_LENGTH = 300
const LARGE_DIFF_INLINE_DIFF_MAX_LINE_LENGTH = 120

type DiffPaneProps = {
  diff: PreparedFileDiffResult | null
  hasSelectedFile: boolean
  viewMode: "split" | "unified"
}

export function DiffPane({ diff, hasSelectedFile, viewMode }: DiffPaneProps) {
  const options = useMemo(
    () => ({
      diffStyle: viewMode,
      diffIndicators: "bars" as const,
      disableFileHeader: true,
      overflow: "scroll" as const,
      hunkSeparators: "line-info" as const,
      expandUnchanged: false,
      expansionLineCount: DIFF_EXPANSION_LINE_COUNT,
      maxLineDiffLength: diff?.isLargeDiff
        ? LARGE_DIFF_INLINE_DIFF_MAX_LINE_LENGTH
        : FAST_INLINE_DIFF_MAX_LINE_LENGTH,
    }),
    [diff?.isLargeDiff, viewMode]
  )

  if (!diff) {
    if (hasSelectedFile) {
      return <div className="h-full min-h-0" />
    }

    return (
      <div className="flex h-full min-h-0 items-center justify-center rounded-lg border border-dashed border-border/60 bg-background/40 px-6 text-center text-sm text-muted-foreground">
        Select a file to view its diff.
      </div>
    )
  }

  if (diff.binary) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center rounded-lg border border-dashed border-border/60 bg-background/40 px-6 text-center text-sm text-muted-foreground">
        Binary files are not rendered in the inline diff viewer yet.
      </div>
    )
  }

  if (diff.tooLarge) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center rounded-lg border border-dashed border-border/60 bg-background/40 px-6 text-center text-sm text-muted-foreground">
        This file is too large for the fast inline diff path right now.
      </div>
    )
  }

  if (diff.isPureRename) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center rounded-lg border border-dashed border-border/60 bg-background/40 px-6 text-center text-sm text-muted-foreground">
        File renamed without textual changes.
      </div>
    )
  }

  if (!diff.parsedDiff) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center rounded-lg border border-dashed border-border/60 bg-background/40 px-6 text-center text-sm text-muted-foreground">
        No text diff is available for this file.
      </div>
    )
  }

  return (
    <FileDiff
      fileDiff={diff.parsedDiff}
      options={options}
      className="block h-full min-h-full min-w-0 font-mono text-sm"
    />
  )
}
