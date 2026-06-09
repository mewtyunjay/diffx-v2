import type { MergeConflictRegion, MergeConflictResolution } from "@pierre/diffs/react"

const splitWithNewlines = /(?<=\n)/

function splitContentsIntoLines(contents: string) {
  return contents === "" ? [] : contents.split(splitWithNewlines)
}

function assertMarkerLine(lines: string[], index: number, prefix: string, label: string) {
  if (!lines[index]?.startsWith(prefix)) {
    throw new Error(`Invalid merge conflict ${label} marker at line index ${index}.`)
  }
}

function assertValidConflictRegion(lines: string[], conflict: MergeConflictRegion) {
  const {
    startLineIndex,
    separatorLineIndex,
    endLineIndex,
    baseMarkerLineIndex,
  } = conflict

  if (
    startLineIndex < 0 ||
    separatorLineIndex <= startLineIndex ||
    endLineIndex <= separatorLineIndex ||
    endLineIndex >= lines.length
  ) {
    throw new Error("Invalid merge conflict region.")
  }

  if (
    baseMarkerLineIndex != null &&
    (baseMarkerLineIndex <= startLineIndex || baseMarkerLineIndex >= separatorLineIndex)
  ) {
    throw new Error("Invalid merge conflict base marker region.")
  }

  assertMarkerLine(lines, startLineIndex, "<<<<<<<", "start")
  if (baseMarkerLineIndex != null) {
    assertMarkerLine(lines, baseMarkerLineIndex, "|||||||", "base")
  }
  assertMarkerLine(lines, separatorLineIndex, "=======", "separator")
  assertMarkerLine(lines, endLineIndex, ">>>>>>>", "end")
}

export function resolveMergeConflictContents(
  contents: string,
  conflict: MergeConflictRegion,
  resolution: MergeConflictResolution
) {
  const lines = splitContentsIntoLines(contents)
  assertValidConflictRegion(lines, conflict)

  const currentEndIndex = conflict.baseMarkerLineIndex ?? conflict.separatorLineIndex
  const currentLines = lines.slice(conflict.startLineIndex + 1, currentEndIndex)
  const incomingLines = lines.slice(conflict.separatorLineIndex + 1, conflict.endLineIndex)
  const replacementLines =
    resolution === "current"
      ? currentLines
      : resolution === "incoming"
        ? incomingLines
        : [...currentLines, ...incomingLines]

  return [
    ...lines.slice(0, conflict.startLineIndex),
    ...replacementLines,
    ...lines.slice(conflict.endLineIndex + 1),
  ].join("")
}
