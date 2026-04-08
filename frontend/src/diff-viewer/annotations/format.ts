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

export function formatSavedAnnotationsForCopy(annotations: SavedDiffAnnotation[]) {
  const sorted = [...annotations].sort(sortAnnotations)
  const groups = new Map<string, SavedDiffAnnotation[]>()

  for (const annotation of sorted) {
    const key = [annotation.path, annotation.previousPath ?? "", annotation.status].join("::")
    const group = groups.get(key)
    if (group) {
      group.push(annotation)
    } else {
      groups.set(key, [annotation])
    }
  }

  return Array.from(groups.values())
    .map((group) => {
      const [first] = group
      const headerParts = [`File: ${first.path}`, `[${first.status}]`]
      if (first.previousPath) {
        headerParts.push(`from ${first.previousPath}`)
      }

      const lines = group.map((annotation) => {
        const annotationLines = annotation.comment.split(/\r?\n/)
        const formattedAnnotationLines = annotationLines.map((line, index) =>
          index === 0 ? `  annotation: ${line}` : `    ${line}`
        )
        const patchMetadataLines = annotation.patchMetadata
          ? [
              `  patch metadata:`,
              `    hunk index: ${annotation.patchMetadata.hunkIndex}`,
              annotation.patchMetadata.hunkSpecs
                ? `    hunk specs: ${annotation.patchMetadata.hunkSpecs}`
                : null,
              annotation.patchMetadata.hunkContext
                ? `    hunk context: ${annotation.patchMetadata.hunkContext}`
                : null,
              `    additions: start=${annotation.patchMetadata.additionStart} count=${annotation.patchMetadata.additionCount} lines=${annotation.patchMetadata.additionLines}`,
              `    deletions: start=${annotation.patchMetadata.deletionStart} count=${annotation.patchMetadata.deletionCount} lines=${annotation.patchMetadata.deletionLines}`,
              `    split lines: start=${annotation.patchMetadata.splitLineStart} count=${annotation.patchMetadata.splitLineCount}`,
              `    unified lines: start=${annotation.patchMetadata.unifiedLineStart} count=${annotation.patchMetadata.unifiedLineCount}`,
            ].filter((line): line is string => line != null)
          : [`  patch metadata: none`]

        return [
          `- ${annotation.side} line ${annotation.lineNumber}`,
          ...formattedAnnotationLines,
          `  file metadata: base=${annotation.baseRef}@${annotation.baseCommit} status=${annotation.status} before=${annotation.beforeCacheKey} after=${annotation.afterCacheKey}`,
          ...patchMetadataLines,
        ].join("\n")
      })

      return [headerParts.join(" "), ...lines].join("\n")
    })
    .join("\n\n")
}
