import { useMemo } from "react"
import { LoaderCircle, RefreshCcw } from "lucide-react"

import type { UseAISettingsResult } from "@/app/ai/hooks/useAISettings"
import { AI_PROVIDER_IDS, AI_PROVIDER_LABELS, type AIProviderID } from "@/app/ai/types"
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
}

export function AISettingsModal({ open, onOpenChange, settingsState }: AISettingsModalProps) {
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

  const commitFeatureState = featureStateByID.commitMessage
  const selectedProvider = draftProviders.commitMessage
  const selectableProviderCount = useMemo(
    () => agents.filter((agent) => agent.selectable).length,
    [agents]
  )

  const isSelectDisabled = isLoading || isSaving || isCheckingAgents || agents.length === 0
  const selectedProviderIsSelectable =
    selectedProvider === ""
      ? false
      : (agents.find((agent) => agent.id === selectedProvider)?.selectable ?? false)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] w-[min(92vw,36rem)] overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-border px-5 py-4 pr-10">
          <DialogTitle>AI</DialogTitle>
          <DialogDescription>Configure headless AI provider for commit message generation.</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center gap-2 border-b border-border px-5 py-3">
              <LoaderCircle className="size-4 animate-spin" />
              <p className="type-meta text-muted-foreground">Loading AI settings...</p>
            </div>
          ) : null}

          {loadError ? (
            <div className="border-b border-border bg-destructive/10 px-5 py-3">
              <p className="type-meta text-destructive">{loadError}</p>
            </div>
          ) : null}

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
                className="h-9 w-full rounded-md border border-border/70 bg-background/85 px-3 text-sm text-foreground outline-none ring-0 transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-70"
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
              disabled={isSaving}
              onClick={() => {
                resetDraftProviders()
                onOpenChange(false)
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!hasLocalEdits || isSaving}
              onClick={() => {
                void saveProviders()
              }}
            >
              {isSaving ? <LoaderCircle className="animate-spin" /> : null}
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
