import type { AnnotationSide } from "@pierre/diffs/react"

import type { ChangedFileStatus } from "@/git/types"

export type SavedAnnotationTarget = {
  path: string
  previousPath?: string
  status: ChangedFileStatus
  side: AnnotationSide
  lineNumber: number
}

export type DraftDiffAnnotation = SavedAnnotationTarget & {
  comment: string
}

export type SavedDiffAnnotation = SavedAnnotationTarget & {
  contentKey: string
  baseRef: string
  baseCommit: string
  beforeCacheKey: string
  afterCacheKey: string
  patchMetadata?: SavedDiffPatchMetadata
  comment: string
  updatedAt: string
}

export type SavedDiffPatchMetadata = {
  hunkIndex: number
  hunkContext?: string
  hunkSpecs?: string
  additionStart: number
  additionCount: number
  additionLines: number
  deletionStart: number
  deletionCount: number
  deletionLines: number
  splitLineStart: number
  splitLineCount: number
  unifiedLineStart: number
  unifiedLineCount: number
}

export type SaveDiffAnnotationInput = SavedAnnotationTarget & {
  contentKey: string
  baseRef: string
  baseCommit: string
  beforeCacheKey: string
  afterCacheKey: string
  patchMetadata?: SavedDiffPatchMetadata
  comment: string
}

export type SavedAnnotationsPayload = {
  version: number
  annotations: SavedDiffAnnotation[]
}
