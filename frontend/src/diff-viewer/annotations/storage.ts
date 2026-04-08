import type { SavedAnnotationsPayload, SavedDiffAnnotation } from "@/diff-viewer/annotations/types"

const STORAGE_KEY = "diffx:diff-viewer:saved-annotations"
const STORAGE_VERSION = 2

function isBrowser() {
  return typeof window !== "undefined"
}

function normalizeComment(comment: string) {
  return comment.trim()
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
