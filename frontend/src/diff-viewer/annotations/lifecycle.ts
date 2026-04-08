import type { ChangedFileItem } from "@/git/types"
import type { PreparedFileDiffResult } from "@/diffs/create"
import { createAnnotationKey } from "@/diff-viewer/annotations/identity"
import type {
  SaveDiffAnnotationInput,
  SavedAnnotationTarget,
  SavedDiffAnnotation,
} from "@/diff-viewer/annotations/types"

function normalizeComment(comment: string) {
  return comment.trim()
}

function matchesFile(
  annotation: SavedDiffAnnotation,
  file: Pick<ChangedFileItem, "path" | "previousPath" | "status" | "contentKey">
) {
  return (
    annotation.path === file.path &&
    (annotation.previousPath ?? "") === (file.previousPath ?? "") &&
    annotation.status === file.status &&
    annotation.contentKey === file.contentKey
  )
}

export function createSavedAnnotation(input: SaveDiffAnnotationInput): SavedDiffAnnotation | null {
  const comment = normalizeComment(input.comment)
  if (comment.length === 0) {
    return null
  }

  return {
    ...input,
    comment,
    updatedAt: new Date().toISOString(),
  }
}

export function upsertSavedAnnotation(
  annotations: SavedDiffAnnotation[],
  nextAnnotation: SavedDiffAnnotation
) {
  const key = createAnnotationKey(nextAnnotation)
  const remaining = annotations.filter((annotation) => createAnnotationKey(annotation) !== key)
  return [...remaining, nextAnnotation]
}

export function removeSavedAnnotation(
  annotations: SavedDiffAnnotation[],
  target: SavedAnnotationTarget
) {
  const key = createAnnotationKey(target)
  return annotations.filter((annotation) => createAnnotationKey(annotation) !== key)
}

export function pruneSavedAnnotationsForFiles(
  annotations: SavedDiffAnnotation[],
  files: Pick<ChangedFileItem, "path" | "previousPath" | "status" | "contentKey">[]
) {
  return annotations.filter((annotation) => files.some((file) => matchesFile(annotation, file)))
}

export function pruneSavedAnnotationsForDiff(
  annotations: SavedDiffAnnotation[],
  diff: Pick<
    PreparedFileDiffResult,
    "path" | "previousPath" | "status" | "baseCommit" | "before" | "after"
  >
) {
  return annotations.filter((annotation) => {
    const sameFile =
      annotation.path === diff.path &&
      (annotation.previousPath ?? "") === (diff.previousPath ?? "") &&
      annotation.status === diff.status

    if (!sameFile) {
      return true
    }

    return (
      annotation.baseCommit === diff.baseCommit &&
      annotation.beforeCacheKey === diff.before.cacheKey &&
      annotation.afterCacheKey === diff.after.cacheKey
    )
  })
}

export function getSavedAnnotationsForDiff(
  annotations: SavedDiffAnnotation[],
  diff: Pick<
    PreparedFileDiffResult,
    "path" | "previousPath" | "status" | "baseCommit" | "before" | "after"
  >
) {
  return annotations.filter(
    (annotation) =>
      annotation.path === diff.path &&
      (annotation.previousPath ?? "") === (diff.previousPath ?? "") &&
      annotation.status === diff.status &&
      annotation.baseCommit === diff.baseCommit &&
      annotation.beforeCacheKey === diff.before.cacheKey &&
      annotation.afterCacheKey === diff.after.cacheKey
  )
}
