import type { FileDiffMetadata } from "@pierre/diffs"

import type { FileDiffResult } from "@/app/changed-files/api"

export const LARGE_DIFF_CHAR_THRESHOLD = 60_000

export type PreparedFileDiffResult = FileDiffResult & {
  parsedDiff: FileDiffMetadata | null
  isLargeDiff: boolean
  isPureRename: boolean
}

export type PrepareDiffWorkerRequest = {
  id: number
  diff: FileDiffResult
}

export type PrepareDiffWorkerResponse =
  | {
      id: number
      preparedDiff: PreparedFileDiffResult
    }
  | {
      id: number
      error: string
    }

export function isPureRenameDiff(diff: FileDiffResult) {
  return diff.status === "renamed" && diff.before.cacheKey === diff.after.cacheKey
}

export function isLargeDiff(diff: FileDiffResult) {
  return Math.max(diff.before.contents.length, diff.after.contents.length) > LARGE_DIFF_CHAR_THRESHOLD
}

export function finalizePreparedFileDiff(
  diff: FileDiffResult,
  parsedDiff: FileDiffMetadata | null
): PreparedFileDiffResult {
  return {
    ...diff,
    parsedDiff,
    isLargeDiff: isLargeDiff(diff),
    isPureRename: isPureRenameDiff(diff),
  }
}

export function clonePreparedFileDiff(diff: PreparedFileDiffResult): PreparedFileDiffResult {
  return structuredClone(diff)
}
