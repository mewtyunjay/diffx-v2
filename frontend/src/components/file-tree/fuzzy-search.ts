import type { ChangedFileItem } from "@/git/types"

type FileMatch = {
  file: ChangedFileItem
  score: number
  index: number
}

function normalizeSearchValue(value: string) {
  return value.trim().toLowerCase()
}

function scoreFuzzyMatch(value: string, query: string) {
  if (query.length === 0) {
    return 0
  }

  const substringIndex = value.indexOf(query)
  if (substringIndex !== -1) {
    return substringIndex + query.length / Math.max(value.length, 1)
  }

  let queryIndex = 0
  let firstMatchIndex = -1
  let lastMatchIndex = -1
  let gapScore = 0

  for (let valueIndex = 0; valueIndex < value.length && queryIndex < query.length; valueIndex += 1) {
    if (value[valueIndex] !== query[queryIndex]) {
      continue
    }

    if (firstMatchIndex === -1) {
      firstMatchIndex = valueIndex
    }

    if (lastMatchIndex !== -1) {
      gapScore += valueIndex - lastMatchIndex - 1
    }

    lastMatchIndex = valueIndex
    queryIndex += 1
  }

  if (queryIndex !== query.length || firstMatchIndex === -1) {
    return null
  }

  return value.length + firstMatchIndex + gapScore
}

export function fuzzyFilterChangedFiles(files: ChangedFileItem[], query: string) {
  const normalizedQuery = normalizeSearchValue(query)

  if (!normalizedQuery) {
    return files
  }

  return files
    .reduce<FileMatch[]>((matches, file, index) => {
      const score = scoreFuzzyMatch(normalizeSearchValue(file.displayPath), normalizedQuery)

      if (score != null) {
        matches.push({ file, score, index })
      }

      return matches
    }, [])
    .sort((left, right) => left.score - right.score || left.index - right.index)
    .map((match) => match.file)
}
