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
  if (message.includes("provider \"claude\" is not selectable") && message.includes("credentials not detected")) {
    return "Claude is not logged in. Open Claude CLI, run `claude auth login` (or `/login`), then retry."
  }
  if (message.includes("provider \"claude\" is not selectable") && message.includes("too old for headless credential detection")) {
    return "Claude CLI is outdated for headless auth checks. Update Claude Code, then retry."
  }
  if (message.includes("claude headless execution failed") && message.includes("Please run /login")) {
    return "Claude is not logged in. Open Claude CLI, run /login, then retry commit message generation."
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
