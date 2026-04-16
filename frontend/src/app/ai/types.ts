export type AIProviderID = "codex" | "claude"
export type AIFeatureID = "commitMessage"

export type FeatureProviders = {
  commitMessage: AIProviderID | ""
}

export type AIAgentStatus = {
  id: AIProviderID
  label: string
  binaryPath?: string
  available: boolean
  headlessCapable: boolean
  selectable: boolean
  checking: boolean
  reason?: string
}

export type AIFeatureState = {
  featureId: AIFeatureID
  provider: AIProviderID | ""
  providerValid: boolean
  suggestedProvider: AIProviderID | ""
}

export type AISettingsResponse = {
  features: FeatureProviders
  featureStates: AIFeatureState[]
  agents: AIAgentStatus[]
  isCheckingAgents: boolean
}

export type AIAgentsResponse = {
  agents: AIAgentStatus[]
  isCheckingAgents: boolean
}

export type AICommitMessageSuggestion = {
  provider: AIProviderID
  message: string
}

export const AI_PROVIDER_IDS: AIProviderID[] = ["codex", "claude"]

export const AI_PROVIDER_LABELS: Record<AIProviderID, string> = {
  codex: "Codex",
  claude: "Claude",
}

export const EMPTY_FEATURE_PROVIDERS: FeatureProviders = {
  commitMessage: "",
}
