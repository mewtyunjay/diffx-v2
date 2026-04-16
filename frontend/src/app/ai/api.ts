import type {
  AIAgentsResponse,
  AICommitMessageSuggestion,
  AISettingsResponse,
  FeatureProviders,
} from "@/app/ai/types"

async function readError(response: Response) {
  const text = await response.text()
  return text || `Request failed with status ${response.status}`
}

async function readJSON<TResponse>(response: Response) {
  if (!response.ok) {
    throw new Error(await readError(response))
  }

  return (await response.json()) as TResponse
}

async function postJSON<TResponse>(url: string, body?: unknown, signal?: AbortSignal) {
  const response = await fetch(url, {
    method: "POST",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  })

  return readJSON<TResponse>(response)
}

export async function fetchAISettings(signal?: AbortSignal) {
  const response = await fetch("/api/ai/settings", { signal })
  return readJSON<AISettingsResponse>(response)
}

export async function updateAISettings(features: FeatureProviders, signal?: AbortSignal) {
  return postJSON<AISettingsResponse>("/api/ai/settings/update", { features }, signal)
}

export async function fetchAIAgents(signal?: AbortSignal) {
  const response = await fetch("/api/ai/agents", { signal })
  return readJSON<AIAgentsResponse>(response)
}

export async function refreshAIAgents(signal?: AbortSignal) {
  return postJSON<AIAgentsResponse>("/api/ai/agents/refresh", undefined, signal)
}

export async function suggestCommitMessage(signal?: AbortSignal) {
  return postJSON<AICommitMessageSuggestion>(
    "/api/ai/features/commit-message/suggest",
    undefined,
    signal
  )
}
