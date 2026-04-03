function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

export function getToastErrorDescription(error: unknown, fallback: string) {
  const message = getErrorMessage(error, fallback)

  if (message.includes("path is ignored by git") || message.includes("paths are ignored")) {
    return "Git is ignoring this path."
  }
  if (message.includes("pathspec") && message.includes("did not match any files")) {
    return "Git could not find that path."
  }
  if (message.includes("no staged changes")) {
    return "No staged files are ready to commit."
  }

  const [firstLine] = message
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)

  if (!firstLine) {
    return fallback
  }

  const normalized = firstLine.replace(/^git\s+[^:]+:\s*/, "")
  return normalized.length > 88 ? `${normalized.slice(0, 85)}...` : normalized
}
