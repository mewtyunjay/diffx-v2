import {
  parseDiffFromFile,
  type FileContents,
  type FileDiffMetadata,
  type SupportedLanguages,
} from "@pierre/diffs"

import type { FileDiffResult } from "@/app/changed-files/api"

export const DIFF_CONTEXT_LINES = 3
export const LARGE_DIFF_CHAR_THRESHOLD = 60_000

export type PreparedFileDiffResult = FileDiffResult & {
  parsedDiff: FileDiffMetadata | null
  isLargeDiff: boolean
  isPureRename: boolean
}

function toSupportedLanguage(language?: string) {
  return (language ?? "text") as SupportedLanguages
}

function createFileVersion(
  name: string,
  contents: string,
  cacheKey: string,
  language: SupportedLanguages
): FileContents {
  return {
    name,
    contents,
    cacheKey,
    lang: language,
  }
}

export function prepareFileDiff(diff: FileDiffResult): PreparedFileDiffResult {
  const language = toSupportedLanguage(diff.language)
  const isPureRename =
    diff.status === "renamed" && diff.before.cacheKey === diff.after.cacheKey
  const isLargeDiff =
    Math.max(diff.before.contents.length, diff.after.contents.length) > LARGE_DIFF_CHAR_THRESHOLD

  let parsedDiff: FileDiffMetadata | null = null

  if (!diff.binary && !diff.tooLarge && !isPureRename) {
    try {
      parsedDiff = parseDiffFromFile(
        createFileVersion(diff.before.name, diff.before.contents, diff.before.cacheKey, language),
        createFileVersion(diff.after.name, diff.after.contents, diff.after.cacheKey, language),
        {
          context: DIFF_CONTEXT_LINES,
        }
      )
    } catch {
      parsedDiff = null
    }
  }

  return {
    ...diff,
    parsedDiff,
    isLargeDiff,
    isPureRename,
  }
}
