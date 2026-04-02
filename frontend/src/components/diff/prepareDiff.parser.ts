import {
  parseDiffFromFile,
  type FileContents,
  type SupportedLanguages,
} from "@pierre/diffs"

import type { FileDiffResult } from "@/app/changed-files/api"

import {
  finalizePreparedFileDiff,
  isPureRenameDiff,
  type PreparedFileDiffResult,
} from "./prepareDiff"

const DIFF_CONTEXT_LINES = 3

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
  let parsedDiff = null

  if (!diff.binary && !diff.tooLarge && !isPureRenameDiff(diff)) {
    const language = toSupportedLanguage(diff.language)

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

  return finalizePreparedFileDiff(diff, parsedDiff)
}
