import type { PreparedFileDiffResult } from "@/diffs/create"

import type { SavedAnnotationTarget, SavedDiffPatchMetadata } from "@/diff-viewer/annotations/types"

type ParsedHunk = NonNullable<PreparedFileDiffResult["parsedDiff"]>["hunks"][number]

function isLineWithinRange(lineNumber: number, start: number, lineCount: number) {
  if (start <= 0 || lineCount <= 0) {
    return false
  }

  return lineNumber >= start && lineNumber < start + lineCount
}

function trimTrailingLineBreak(value: string) {
  return value.replace(/\r?\n$/, "")
}

function renderHunkPatch(
  hunk: ParsedHunk,
  linesBySide: { additions: string[]; deletions: string[] }
) {
  const lines: string[] = []
  if (hunk.hunkSpecs) {
    lines.push(hunk.hunkSpecs)
  }

  for (const chunk of hunk.hunkContent) {
    if (chunk.type === "context") {
      for (let index = 0; index < chunk.lines; index += 1) {
        const line =
          linesBySide.additions[chunk.additionLineIndex + index] ??
          linesBySide.deletions[chunk.deletionLineIndex + index] ??
          ""
        lines.push(` ${trimTrailingLineBreak(line)}`)
      }
      continue
    }

    for (let index = 0; index < chunk.deletions; index += 1) {
      const line = linesBySide.deletions[chunk.deletionLineIndex + index] ?? ""
      lines.push(`-${trimTrailingLineBreak(line)}`)
    }
    for (let index = 0; index < chunk.additions; index += 1) {
      const line = linesBySide.additions[chunk.additionLineIndex + index] ?? ""
      lines.push(`+${trimTrailingLineBreak(line)}`)
    }
  }

  return lines.join("\n")
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
      ? isLineWithinRange(target.lineNumber, hunk.additionStart, hunk.additionCount)
      : isLineWithinRange(target.lineNumber, hunk.deletionStart, hunk.deletionCount)
  )

  if (hunkIndex < 0) {
    return undefined
  }

  const hunk = hunks[hunkIndex]
  return {
    hunkIndex,
    hunkContext: hunk.hunkContext,
    hunkSpecs: hunk.hunkSpecs,
    hunkPatch: renderHunkPatch(hunk, {
      additions: diff.parsedDiff?.additionLines ?? [],
      deletions: diff.parsedDiff?.deletionLines ?? [],
    }),
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
