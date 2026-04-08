import type { PreparedFileDiffResult } from "@/diffs/create"

import type { SavedAnnotationTarget, SavedDiffPatchMetadata } from "@/diff-viewer/annotations/types"

function isLineWithinRange(lineNumber: number, start: number, lineCount: number) {
  if (start <= 0 || lineCount <= 0) {
    return false
  }

  return lineNumber >= start && lineNumber < start + lineCount
}

export function findPatchMetadataForAnnotation(
  diff: Pick<PreparedFileDiffResult, "parsedDiff">,
  target: Pick<SavedAnnotationTarget, "lineNumber" | "side">
): SavedDiffPatchMetadata | undefined {
  const hunks = diff.parsedDiff?.hunks
  if (!hunks) {
    return undefined
  }

  const hunkIndex = hunks.findIndex((hunk) =>
    target.side === "additions"
      ? isLineWithinRange(target.lineNumber, hunk.additionStart, hunk.additionLines)
      : isLineWithinRange(target.lineNumber, hunk.deletionStart, hunk.deletionLines)
  )

  if (hunkIndex < 0) {
    return undefined
  }

  const hunk = hunks[hunkIndex]
  return {
    hunkIndex,
    hunkContext: hunk.hunkContext,
    hunkSpecs: hunk.hunkSpecs,
    additionStart: hunk.additionStart,
    additionCount: hunk.additionCount,
    additionLines: hunk.additionLines,
    deletionStart: hunk.deletionStart,
    deletionCount: hunk.deletionCount,
    deletionLines: hunk.deletionLines,
    splitLineStart: hunk.splitLineStart,
    splitLineCount: hunk.splitLineCount,
    unifiedLineStart: hunk.unifiedLineStart,
    unifiedLineCount: hunk.unifiedLineCount,
  }
}
