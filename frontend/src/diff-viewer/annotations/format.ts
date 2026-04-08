import type { SavedDiffAnnotation } from "@/diff-viewer/annotations/types"

function sortAnnotations(a: SavedDiffAnnotation, b: SavedDiffAnnotation) {
  if (a.path !== b.path) {
    return a.path.localeCompare(b.path)
  }
  if (a.lineNumber !== b.lineNumber) {
    return a.lineNumber - b.lineNumber
  }
  if (a.side !== b.side) {
    return a.side === "deletions" ? -1 : 1
  }
  return a.updatedAt.localeCompare(b.updatedAt)
}

function toSingleLine(value: string) {
  return value.replace(/\s+/g, " ").trim()
}

function formatMessage(comment: string) {
  const normalized = toSingleLine(comment)
  if (normalized.length === 0) {
    return "(no message provided)"
  }

  return normalized
}

function formatLocation(annotation: SavedDiffAnnotation) {
  const sidePrefix = annotation.side === "additions" ? "+" : "-"
  return `${sidePrefix}${annotation.lineNumber}`
}

function formatPatch(annotation: SavedDiffAnnotation) {
  const patch = annotation.patchMetadata?.hunkPatch?.trim()
  if (patch && patch.length > 0) {
    return patch
  }

  const specs = annotation.patchMetadata?.hunkSpecs
  if (!specs) {
    return "none"
  }

  return toSingleLine(specs)
}

export function formatSavedAnnotationsForCopy(annotations: SavedDiffAnnotation[]) {
  const sorted = [...annotations].sort(sortAnnotations)
  const issueBlocks = sorted.map((annotation, index) => {
    const patch = formatPatch(annotation)
    const patchLines =
      patch === "none"
        ? ["patch: none"]
        : [
            "patch:",
            "```diff",
            patch,
            "```",
          ]

    return [
      `ISSUE ${index + 1}`,
      `file: ${annotation.path}`,
      `status: ${annotation.status}`,
      `from: ${annotation.previousPath ?? "none"}`,
      `line: ${formatLocation(annotation)}`,
      ...patchLines,
      `message: ${formatMessage(annotation.comment)}`,
    ].join("\n")
  })

  return issueBlocks.join("\n\n")
}
