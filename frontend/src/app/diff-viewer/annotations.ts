import type { AnnotationSide } from "@pierre/diffs/react"

import type { ChangedFileItem, ChangedFileStatus } from "@/app/changed-files/api"
import type { PreparedFileDiffResult } from "@/components/diff/prepareDiff"

const STORAGE_KEY = "diffx:diff-viewer:saved-annotations"
const STORAGE_VERSION = 1

type SavedAnnotationsPayload = {
  version: number
  annotations: SavedDiffAnnotation[]
}

export type SavedAnnotationTarget = {
  path: string
  previousPath?: string
  status: ChangedFileStatus
  side: AnnotationSide
  lineNumber: number
}

export type SavedDiffAnnotation = SavedAnnotationTarget & {
  contentKey: string
  headCommit: string
  beforeCacheKey: string
  afterCacheKey: string
  comment: string
  updatedAt: string
}

export type SaveDiffAnnotationInput = SavedAnnotationTarget & {
  contentKey: string
  headCommit: string
  beforeCacheKey: string
  afterCacheKey: string
  comment: string
}

function isBrowser() {
  return typeof window !== "undefined"
}

function normalizeComment(comment: string) {
  return comment.trim()
}

function createAnnotationKey(annotation: SavedAnnotationTarget) {
  return [
    annotation.path,
    annotation.previousPath ?? "",
    annotation.status,
    annotation.side,
    String(annotation.lineNumber),
  ].join("::")
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

export function loadSavedAnnotations() {
  if (!isBrowser()) {
    return [] as SavedDiffAnnotation[]
  }

  const rawValue = window.sessionStorage.getItem(STORAGE_KEY)
  if (!rawValue) {
    return [] as SavedDiffAnnotation[]
  }

  try {
    const payload = JSON.parse(rawValue) as SavedAnnotationsPayload
    if (payload.version !== STORAGE_VERSION || !Array.isArray(payload.annotations)) {
      return [] as SavedDiffAnnotation[]
    }

    return payload.annotations
      .map((annotation) => ({
        ...annotation,
        comment: typeof annotation.comment === "string" ? normalizeComment(annotation.comment) : "",
      }))
      .filter((annotation) => annotation.comment.length > 0)
  } catch {
    return [] as SavedDiffAnnotation[]
  }
}

export function persistSavedAnnotations(annotations: SavedDiffAnnotation[]) {
  if (!isBrowser()) {
    return
  }

  if (annotations.length === 0) {
    window.sessionStorage.removeItem(STORAGE_KEY)
    return
  }

  const payload: SavedAnnotationsPayload = {
    version: STORAGE_VERSION,
    annotations,
  }

  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
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
    "path" | "previousPath" | "status" | "headCommit" | "before" | "after"
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
      annotation.headCommit === diff.headCommit &&
      annotation.beforeCacheKey === diff.before.cacheKey &&
      annotation.afterCacheKey === diff.after.cacheKey
    )
  })
}

export function getSavedAnnotationsForDiff(
  annotations: SavedDiffAnnotation[],
  diff: Pick<
    PreparedFileDiffResult,
    "path" | "previousPath" | "status" | "headCommit" | "before" | "after"
  >
) {
  return annotations.filter(
    (annotation) =>
      annotation.path === diff.path &&
      (annotation.previousPath ?? "") === (diff.previousPath ?? "") &&
      annotation.status === diff.status &&
      annotation.headCommit === diff.headCommit &&
      annotation.beforeCacheKey === diff.before.cacheKey &&
      annotation.afterCacheKey === diff.after.cacheKey
  )
}

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
        const [firstLine, ...restLines] = annotation.comment.split(/\r?\n/)
        const indentedRest = restLines.map((line) => `  ${line}`)
        return [`- ${annotation.side} line ${annotation.lineNumber}: ${firstLine}`, ...indentedRest].join("\n")
      })

      return [headerParts.join(" "), ...lines].join("\n")
    })
    .join("\n\n")
}
