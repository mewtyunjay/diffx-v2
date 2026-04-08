import type { PreparedFileDiffResult } from "@/diffs/create"

import type { DraftDiffAnnotation, SavedAnnotationTarget } from "@/diff-viewer/annotations/types"

type DiffAnnotationIdentity = Pick<
  PreparedFileDiffResult,
  "path" | "previousPath" | "status" | "baseCommit" | "before" | "after"
>

export function createAnnotationTargetKey(annotation: Pick<SavedAnnotationTarget, "side" | "lineNumber">) {
  return [annotation.side, String(annotation.lineNumber)].join("::")
}

export function createDiffAnnotationIdentityKey(diff: DiffAnnotationIdentity) {
  return [
    diff.path,
    diff.previousPath ?? "",
    diff.status,
    diff.baseCommit,
    diff.before.cacheKey,
    diff.after.cacheKey,
  ].join("::")
}

export function createDraftDiffAnnotation(
  diff: Pick<PreparedFileDiffResult, "path" | "previousPath" | "status">,
  target: Pick<SavedAnnotationTarget, "side" | "lineNumber">,
  comment = ""
): DraftDiffAnnotation {
  return {
    path: diff.path,
    previousPath: diff.previousPath,
    status: diff.status,
    side: target.side,
    lineNumber: target.lineNumber,
    comment,
  }
}

export function createAnnotationKey(annotation: SavedAnnotationTarget) {
  return [
    annotation.path,
    annotation.previousPath ?? "",
    annotation.status,
    createAnnotationTargetKey(annotation),
  ].join("::")
}
