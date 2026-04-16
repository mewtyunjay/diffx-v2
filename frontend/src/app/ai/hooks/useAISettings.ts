import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { fetchAISettings, refreshAIAgents, updateAISettings } from "@/app/ai/api"
import {
  EMPTY_FEATURE_PROVIDERS,
  type AIAgentStatus,
  type AIFeatureID,
  type AIFeatureState,
  type AIProviderID,
  type AISettingsResponse,
  type FeatureProviders,
} from "@/app/ai/types"

type LoadSettingsOptions = {
  preserveLocalEdits?: boolean
  showLoading?: boolean
}

type UseAISettingsResult = {
  settings: AISettingsResponse | null
  agents: AIAgentStatus[]
  agentByID: Partial<Record<AIProviderID, AIAgentStatus>>
  draftProviders: FeatureProviders
  featureStateByID: Partial<Record<AIFeatureID, AIFeatureState>>
  isLoading: boolean
  isSaving: boolean
  isRefreshingAgents: boolean
  isCheckingAgents: boolean
  hasLocalEdits: boolean
  loadError: string | null
  saveError: string | null
  setCommitProvider: (provider: AIProviderID) => void
  resetDraftProviders: () => void
  saveProviders: () => Promise<boolean>
  refreshAgents: () => Promise<void>
}

export function useAISettings(): UseAISettingsResult {
  const [settings, setSettings] = useState<AISettingsResponse | null>(null)
  const [draftProviders, setDraftProviders] = useState<FeatureProviders>(EMPTY_FEATURE_PROVIDERS)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isRefreshingAgents, setIsRefreshingAgents] = useState(false)
  const [hasLocalEdits, setHasLocalEdits] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const hasLocalEditsRef = useRef(false)

  useEffect(() => {
    hasLocalEditsRef.current = hasLocalEdits
  }, [hasLocalEdits])

  const loadSettings = useCallback(async (options?: LoadSettingsOptions) => {
    const preserveLocalEdits = options?.preserveLocalEdits ?? false
    const showLoading = options?.showLoading ?? false

    if (showLoading) {
      setIsLoading(true)
    }

    try {
      const response = await fetchAISettings()
      setSettings(response)
      setLoadError(null)

      if (!preserveLocalEdits || !hasLocalEditsRef.current) {
        setDraftProviders(response.features)
        setHasLocalEdits(false)
      }
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Unable to load AI settings.")
    } finally {
      if (showLoading) {
        setIsLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    void loadSettings({ showLoading: true })
  }, [loadSettings])

  useEffect(() => {
    if (!settings?.isCheckingAgents) {
      return
    }

    const timeoutID = window.setTimeout(() => {
      void loadSettings({ preserveLocalEdits: true })
    }, 1800)

    return () => window.clearTimeout(timeoutID)
  }, [loadSettings, settings?.isCheckingAgents])

  const featureStateByID = useMemo(() => {
    const map: Partial<Record<AIFeatureID, AIFeatureState>> = {}
    for (const featureState of settings?.featureStates ?? []) {
      map[featureState.featureId] = featureState
    }
    return map
  }, [settings?.featureStates])

  const agentByID = useMemo(() => {
    const map: Partial<Record<AIProviderID, AIAgentStatus>> = {}
    for (const agent of settings?.agents ?? []) {
      map[agent.id] = agent
    }
    return map
  }, [settings?.agents])

  const setCommitProvider = useCallback((provider: AIProviderID) => {
    setDraftProviders((current) => ({ ...current, commitMessage: provider }))
    setHasLocalEdits(true)
    setSaveError(null)
  }, [])

  const resetDraftProviders = useCallback(() => {
    if (!settings) {
      return
    }

    setDraftProviders(settings.features)
    setHasLocalEdits(false)
    setSaveError(null)
  }, [settings])

  const saveProviders = useCallback(async () => {
    setIsSaving(true)
    setSaveError(null)

    try {
      const response = await updateAISettings(draftProviders)
      setSettings(response)
      setDraftProviders(response.features)
      setHasLocalEdits(false)
      return true
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Unable to save AI settings.")
      return false
    } finally {
      setIsSaving(false)
    }
  }, [draftProviders])

  const refreshAgentsState = useCallback(async () => {
    setIsRefreshingAgents(true)
    setLoadError(null)

    try {
      await refreshAIAgents()
      await loadSettings({ preserveLocalEdits: true })
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Unable to refresh AI agents.")
    } finally {
      setIsRefreshingAgents(false)
    }
  }, [loadSettings])

  return {
    settings,
    agents: settings?.agents ?? [],
    agentByID,
    draftProviders,
    featureStateByID,
    isLoading,
    isSaving,
    isRefreshingAgents,
    isCheckingAgents: settings?.isCheckingAgents ?? true,
    hasLocalEdits,
    loadError,
    saveError,
    setCommitProvider,
    resetDraftProviders,
    saveProviders,
    refreshAgents: refreshAgentsState,
  }
}

export type { UseAISettingsResult }
