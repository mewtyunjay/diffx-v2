import { useCallback, useEffect, useRef, useState } from "react"

import {
  fetchDiffViewerPreferences,
  updateDiffViewerPreferences,
} from "@/app/diff-viewer/preferencesApi"
import {
  DEFAULT_DIFF_VIEWER_PREFERENCES,
  diffViewerPreferencesEqual,
  normalizeDiffViewerPreferences,
  type DiffDetailMode,
  type DiffViewerPreferences,
  type DiffViewMode,
} from "@/app/diff-viewer/preferences"

type UseDiffViewerPreferencesResult = {
  preferences: DiffViewerPreferences
  draftPreferences: DiffViewerPreferences
  isLoading: boolean
  isSaving: boolean
  hasLocalEdits: boolean
  loadError: string | null
  saveError: string | null
  setDraftViewMode: (viewMode: DiffViewMode) => void
  setDraftDiffDetailMode: (diffDetailMode: DiffDetailMode) => void
  resetDraftPreferences: () => void
  saveDraftPreferences: () => Promise<boolean>
  updateActivePreferences: (preferences: Partial<DiffViewerPreferences>) => Promise<boolean>
}

export function useDiffViewerPreferences(): UseDiffViewerPreferencesResult {
  const [preferences, setPreferences] = useState(DEFAULT_DIFF_VIEWER_PREFERENCES)
  const [draftPreferences, setDraftPreferences] = useState(DEFAULT_DIFF_VIEWER_PREFERENCES)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [hasLocalEdits, setHasLocalEdits] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const preferencesRef = useRef(preferences)
  const hasLocalEditsRef = useRef(false)

  useEffect(() => {
    preferencesRef.current = preferences
  }, [preferences])

  useEffect(() => {
    hasLocalEditsRef.current = hasLocalEdits
  }, [hasLocalEdits])

  useEffect(() => {
    const controller = new AbortController()

    async function loadPreferences() {
      try {
        const response = await fetchDiffViewerPreferences(controller.signal)
        setPreferences(response)
        setLoadError(null)

        if (!hasLocalEditsRef.current) {
          setDraftPreferences(response)
        }
      } catch (error) {
        if (controller.signal.aborted) {
          return
        }

        setLoadError(
          error instanceof Error ? error.message : "Unable to load diff viewer settings."
        )
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    void loadPreferences()

    return () => controller.abort()
  }, [])

  const setDraftViewMode = useCallback((viewMode: DiffViewMode) => {
    setDraftPreferences((current) => normalizeDiffViewerPreferences({ ...current, viewMode }))
    setHasLocalEdits(true)
    setSaveError(null)
  }, [])

  const setDraftDiffDetailMode = useCallback((diffDetailMode: DiffDetailMode) => {
    setDraftPreferences((current) =>
      normalizeDiffViewerPreferences({ ...current, diffDetailMode })
    )
    setHasLocalEdits(true)
    setSaveError(null)
  }, [])

  const resetDraftPreferences = useCallback(() => {
    setDraftPreferences(preferencesRef.current)
    setHasLocalEdits(false)
    setSaveError(null)
  }, [])

  const saveDraftPreferences = useCallback(async () => {
    const normalizedDraft = normalizeDiffViewerPreferences(draftPreferences)
    setIsSaving(true)
    setSaveError(null)

    try {
      const response = await updateDiffViewerPreferences(normalizedDraft)
      setPreferences(response)
      setDraftPreferences(response)
      setHasLocalEdits(false)
      return true
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "Unable to save diff viewer settings."
      )
      return false
    } finally {
      setIsSaving(false)
    }
  }, [draftPreferences])

  const updateActivePreferences = useCallback(
    async (nextPreferences: Partial<DiffViewerPreferences>) => {
      const normalized = normalizeDiffViewerPreferences({
        ...preferencesRef.current,
        ...nextPreferences,
      })

      setPreferences(normalized)
      if (!hasLocalEditsRef.current) {
        setDraftPreferences(normalized)
      }
      setSaveError(null)

      try {
        const response = await updateDiffViewerPreferences(normalized)
        setPreferences(response)
        if (!hasLocalEditsRef.current) {
          setDraftPreferences(response)
        }
        return true
      } catch (error) {
        setSaveError(
          error instanceof Error ? error.message : "Unable to save diff viewer settings."
        )
        return false
      }
    },
    []
  )

  useEffect(() => {
    setHasLocalEdits(!diffViewerPreferencesEqual(preferences, draftPreferences))
  }, [draftPreferences, preferences])

  return {
    preferences,
    draftPreferences,
    isLoading,
    isSaving,
    hasLocalEdits,
    loadError,
    saveError,
    setDraftViewMode,
    setDraftDiffDetailMode,
    resetDraftPreferences,
    saveDraftPreferences,
    updateActivePreferences,
  }
}

export type { UseDiffViewerPreferencesResult }
