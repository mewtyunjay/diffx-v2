import type { ComparisonMode } from "@/git/types"

type CommitSuggestionGuardInput = {
  comparisonMode: ComparisonMode
  stagedFileCount: number
  hiddenStagedFileCount: number
  isCheckingAgents: boolean
  hasProvider: boolean
  providerValid: boolean
  providerReason?: string
}

export function resolveCommitSuggestionDisabledReason({
  comparisonMode,
  stagedFileCount,
  hiddenStagedFileCount,
  isCheckingAgents,
  hasProvider,
  providerValid,
  providerReason,
}: CommitSuggestionGuardInput): string | null {
  if (comparisonMode !== "head") {
    return "Switch to HEAD to generate commit messages."
  }

  if (stagedFileCount === 0) {
    return "Stage at least one file to generate a commit message."
  }

  if (hiddenStagedFileCount > 0) {
    return "Unscope hidden staged files before generation."
  }

  if (isCheckingAgents) {
    return "Checking provider availability..."
  }

  if (!hasProvider) {
    return "Select a provider for Commit Message in settings."
  }

  if (!providerValid) {
    return providerReason ?? "Configured provider is not selectable."
  }

  return null
}
