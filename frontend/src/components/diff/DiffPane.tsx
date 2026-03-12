import { parseDiffFromFile, type FileContents, type SupportedLanguages } from "@pierre/diffs"
import { FileDiff } from "@pierre/diffs/react"
import { useMemo } from "react"

import type { FileDiffResult } from "@/app/changed-files/api"

export const DIFF_CONTEXT_LINES = 3
const DIFF_EXPANSION_LINE_COUNT = 20

const LARGE_DIFF_CHAR_THRESHOLD = 60_000
const FAST_TOKENIZE_MAX_LINE_LENGTH = 500
const LARGE_DIFF_TOKENIZE_MAX_LINE_LENGTH = 200
const FAST_INLINE_DIFF_MAX_LINE_LENGTH = 300
const LARGE_DIFF_INLINE_DIFF_MAX_LINE_LENGTH = 120

type DiffPaneProps = {
  diff: FileDiffResult | null
  viewMode: "split" | "unified"
}

function toSupportedLanguage(language?: string) {
  return (language ?? "text") as SupportedLanguages
}

export function DiffPane({ diff, viewMode }: DiffPaneProps) {
  const language = useMemo(() => toSupportedLanguage(diff?.language), [diff?.language])

  const beforeFile = useMemo<FileContents | null>(() => {
    if (!diff) {
      return null
    }

    return {
      name: diff.before.name,
      contents: diff.before.contents,
      cacheKey: diff.before.cacheKey,
      lang: language,
    }
  }, [diff, language])

  const afterFile = useMemo<FileContents | null>(() => {
    if (!diff) {
      return null
    }

    return {
      name: diff.after.name,
      contents: diff.after.contents,
      cacheKey: diff.after.cacheKey,
      lang: language,
    }
  }, [diff, language])

  const isPureRename =
    diff?.status === "renamed" && diff.before.cacheKey === diff.after.cacheKey

  const isLargeDiff = useMemo(() => {
    if (!diff) {
      return false
    }

    return Math.max(diff.before.contents.length, diff.after.contents.length) > LARGE_DIFF_CHAR_THRESHOLD
  }, [diff])

  const fileDiff = useMemo(() => {
    if (!beforeFile || !afterFile || !diff || diff.binary || diff.tooLarge || isPureRename) {
      return null
    }

    try {
      return parseDiffFromFile(beforeFile, afterFile, {
        context: DIFF_CONTEXT_LINES,
      })
    } catch {
      return null
    }
  }, [afterFile, beforeFile, diff, isPureRename])

  const options = useMemo(
    () => ({
      theme: "pierre-dark",
      diffStyle: viewMode,
      diffIndicators: "bars" as const,
      disableFileHeader: true,
      overflow: "scroll" as const,
      hunkSeparators: "line-info" as const,
      expandUnchanged: false,
      expansionLineCount: DIFF_EXPANSION_LINE_COUNT,
      lineDiffType: isLargeDiff ? "none" as const : "word" as const,
      maxLineDiffLength: isLargeDiff
        ? LARGE_DIFF_INLINE_DIFF_MAX_LINE_LENGTH
        : FAST_INLINE_DIFF_MAX_LINE_LENGTH,
      tokenizeMaxLineLength: isLargeDiff
        ? LARGE_DIFF_TOKENIZE_MAX_LINE_LENGTH
        : FAST_TOKENIZE_MAX_LINE_LENGTH,
    }),
    [isLargeDiff, viewMode]
  )

  if (!diff) {
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

  if (isPureRename) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center rounded-lg border border-dashed border-border/60 bg-background/40 px-6 text-center text-sm text-muted-foreground">
        File renamed without textual changes.
      </div>
    )
  }

  if (!fileDiff) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center rounded-lg border border-dashed border-border/60 bg-background/40 px-6 text-center text-sm text-muted-foreground">
        No text diff is available for this file.
      </div>
    )
  }

  return (
    <FileDiff
      fileDiff={fileDiff}
      options={options}
      className="block h-full min-h-full min-w-0 font-mono text-sm"
    />
  )
}
