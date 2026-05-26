import { useMemo } from "react"
import { LoaderCircle, RefreshCcw } from "lucide-react"

import type { UseAISettingsResult } from "@/app/ai/hooks/useAISettings"
import { AI_PROVIDER_IDS, AI_PROVIDER_LABELS, type AIProviderID } from "@/app/ai/types"
import type { UseDiffViewerPreferencesResult } from "@/app/diff-viewer/useDiffViewerPreferences"
import type { DiffDetailMode, DiffViewMode } from "@/app/diff-viewer/preferences"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

type AISettingsModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  settingsState: UseAISettingsResult
  diffViewerPreferencesState: UseDiffViewerPreferencesResult
}

const DIFF_VIEW_MODE_OPTIONS: Array<{ value: DiffViewMode; label: string }> = [
  { value: "split", label: "Split" },
  { value: "unified", label: "Unified" },
]

const DIFF_DETAIL_MODE_OPTIONS: Array<{ value: DiffDetailMode; label: string }> = [
  { value: "stacked", label: "Stacked" },
  { value: "fullFile", label: "Full file" },
]

const settingsSelectClassName =
  "h-9 w-full rounded-md border border-border/70 bg-background/85 px-3 text-sm text-foreground outline-none ring-0 transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-70"

export function AISettingsModal({
  open,
  onOpenChange,
  settingsState,
  diffViewerPreferencesState,
}: AISettingsModalProps) {
  const {
    agents,
    draftProviders,
    featureStateByID,
    isLoading,
    isSaving,
    isRefreshingAgents,
    isCheckingAgents,
    hasLocalEdits,
    loadError,
    saveError,
    setCommitProvider,
    resetDraftProviders,
    saveProviders,
    refreshAgents,
  } = settingsState
  const {
    draftPreferences,
    isLoading: isDiffViewerPreferencesLoading,
    isSaving: isDiffViewerPreferencesSaving,
    hasLocalEdits: hasDiffViewerPreferenceEdits,
    loadError: diffViewerPreferencesLoadError,
    saveError: diffViewerPreferencesSaveError,
    setDraftViewMode,
    setDraftDiffDetailMode,
    resetDraftPreferences,
    saveDraftPreferences,
  } = diffViewerPreferencesState

  const commitFeatureState = featureStateByID.commitMessage
  const selectedProvider = draftProviders.commitMessage
  const selectableProviderCount = useMemo(
    () => agents.filter((agent) => agent.selectable).length,
    [agents]
  )

  const isSelectDisabled = isLoading || isSaving || isCheckingAgents || agents.length === 0
  const isDiffViewerSelectDisabled =
    isDiffViewerPreferencesLoading || isDiffViewerPreferencesSaving
  const isAnySaving = isSaving || isDiffViewerPreferencesSaving
  const hasAnyLocalEdits = hasLocalEdits || hasDiffViewerPreferenceEdits
  const selectedProviderIsSelectable =
    selectedProvider === ""
      ? false
      : (agents.find((agent) => agent.id === selectedProvider)?.selectable ?? false)

  const handleSaveSettings = async () => {
    await Promise.all([
      hasLocalEdits ? saveProviders() : Promise.resolve(true),
      hasDiffViewerPreferenceEdits ? saveDraftPreferences() : Promise.resolve(true),
    ])
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[80vh] w-[min(92vw,36rem)] flex-col overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-border px-5 py-4 pr-10">
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Configure diff viewer and AI defaults.</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {isLoading || isDiffViewerPreferencesLoading ? (
            <div className="flex items-center gap-2 border-b border-border px-5 py-3">
              <LoaderCircle className="size-4 animate-spin" />
              <p className="type-meta text-muted-foreground">Loading settings...</p>
            </div>
          ) : null}

          {loadError || diffViewerPreferencesLoadError ? (
            <div className="border-b border-border bg-destructive/10 px-5 py-3">
              <p className="type-meta text-destructive">
                {loadError ?? diffViewerPreferencesLoadError}
              </p>
            </div>
          ) : null}

          <section className="space-y-3 border-b border-border px-5 py-4">
            <div className="space-y-1">
              <p className="type-meta font-medium text-foreground">Diff viewer</p>
              <p className="type-meta text-muted-foreground">Defaults for file diffs.</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="diff-view-mode-select" className="type-meta text-muted-foreground">
                  View
                </label>
                <select
                  id="diff-view-mode-select"
                  value={draftPreferences.viewMode}
                  disabled={isDiffViewerSelectDisabled}
                  onChange={(event) => {
                    setDraftViewMode(event.target.value as DiffViewMode)
                  }}
                  className={settingsSelectClassName}
                >
                  {DIFF_VIEW_MODE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="diff-detail-mode-select"
                  className="type-meta text-muted-foreground"
                >
                  Context
                </label>
                <select
                  id="diff-detail-mode-select"
                  value={draftPreferences.diffDetailMode}
                  disabled={isDiffViewerSelectDisabled}
                  onChange={(event) => {
                    setDraftDiffDetailMode(event.target.value as DiffDetailMode)
                  }}
                  className={settingsSelectClassName}
                >
                  {DIFF_DETAIL_MODE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {diffViewerPreferencesSaveError ? (
              <p className="type-meta text-destructive">{diffViewerPreferencesSaveError}</p>
            ) : null}
          </section>

          <section className="space-y-3 border-b border-border px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="type-meta font-medium text-foreground">Commit message provider</p>
                <p className="type-meta text-muted-foreground">
                  Select a headless-ready agent to generate commit subjects.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isRefreshingAgents || isCheckingAgents}
                onClick={() => {
                  void refreshAgents()
                }}
              >
                {isRefreshingAgents ? <LoaderCircle className="animate-spin" /> : <RefreshCcw />}
                Refresh
              </Button>
            </div>

            <div className="space-y-2">
              <label htmlFor="commit-provider-select" className="type-meta text-muted-foreground">
                Provider
              </label>
              <select
                id="commit-provider-select"
                value={selectedProvider}
                disabled={isSelectDisabled}
                onChange={(event) => {
                  const provider = event.target.value as AIProviderID | ""
                  if (!provider) {
                    return
                  }
                  setCommitProvider(provider)
                }}
                className={settingsSelectClassName}
              >
                <option value="">Select provider</option>
                {AI_PROVIDER_IDS.map((providerID) => {
                  const agent = agents.find((item) => item.id === providerID)
                  const selectable = agent?.selectable ?? false
                  return (
                    <option key={providerID} value={providerID} disabled={!selectable}>
                      {AI_PROVIDER_LABELS[providerID]}
                      {!selectable ? " (Unavailable)" : ""}
                    </option>
                  )
                })}
              </select>
              <p className="type-meta text-muted-foreground">
                {selectableProviderCount > 0
                  ? `${selectableProviderCount} headless provider${selectableProviderCount === 1 ? "" : "s"} available.`
                  : "No headless providers are currently available."}
              </p>

              {selectedProvider !== "" && !selectedProviderIsSelectable ? (
                <p className="type-meta text-amber-300">
                  {agents.find((agent) => agent.id === selectedProvider)?.reason ??
                    "Selected provider is not currently selectable."}
                </p>
              ) : null}

              {commitFeatureState && !commitFeatureState.providerValid ? (
                <p className="type-meta text-amber-300">
                  {agents.find((agent) => agent.id === commitFeatureState.provider)?.reason ??
                    "Configured provider is currently invalid."}
                </p>
              ) : null}

              {saveError ? <p className="type-meta text-destructive">{saveError}</p> : null}
            </div>
          </section>

          <section className="space-y-2 px-5 py-4">
            <p className="type-meta font-medium text-foreground">Detected agents</p>
            <div className="space-y-1.5">
              {agents.map((agent) => (
                <div key={agent.id} className="flex items-center justify-between gap-3">
                  <p className="type-meta text-muted-foreground">{agent.label}</p>
                  <span
                    className={cn(
                      "rounded-md px-2 py-0.5 text-[11px] font-medium",
                      agent.selectable
                        ? "bg-emerald-500/15 text-emerald-300"
                        : "bg-amber-500/15 text-amber-300"
                    )}
                  >
                    {agent.selectable ? "Headless ready" : "Unavailable"}
                  </span>
                </div>
              ))}
            </div>
            {isCheckingAgents ? (
              <p className="type-meta text-muted-foreground">Checking provider availability...</p>
            ) : null}
          </section>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border px-5 py-3">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={isAnySaving}
              onClick={() => {
                resetDraftProviders()
                resetDraftPreferences()
                onOpenChange(false)
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!hasAnyLocalEdits || isAnySaving}
              onClick={() => {
                void handleSaveSettings()
              }}
            >
              {isAnySaving ? <LoaderCircle className="animate-spin" /> : null}
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
