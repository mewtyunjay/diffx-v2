package server

import (
	"errors"
	"net/http"

	"diffx/internal/ai"
)

type aiSettingsRequest struct {
	Features ai.FeatureProviders `json:"features"`
}

func (a *App) handleAIAgents(w http.ResponseWriter, r *http.Request) {
	if !allowMethod(w, r, http.MethodGet) {
		return
	}

	agents, isChecking := a.aiService.GetAgents()
	writeJSON(w, http.StatusOK, map[string]any{
		"agents":           agents,
		"isCheckingAgents": isChecking,
	})
}

func (a *App) handleRefreshAIAgents(w http.ResponseWriter, r *http.Request) {
	if !allowMethod(w, r, http.MethodPost) {
		return
	}

	agents, err := a.aiService.RefreshAgents(r.Context())
	if err != nil {
		writeAIError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"agents":           agents,
		"isCheckingAgents": false,
	})
}

func (a *App) handleAISettings(w http.ResponseWriter, r *http.Request) {
	if !allowMethod(w, r, http.MethodGet) {
		return
	}

	settings, err := a.aiService.GetSettings()
	if err != nil {
		writeAIError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, settings)
}

func (a *App) handleUpdateAISettings(w http.ResponseWriter, r *http.Request) {
	if !allowMethod(w, r, http.MethodPost) {
		return
	}

	var request aiSettingsRequest
	if err := readJSONBody(r, &request); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	settings, err := a.aiService.UpdateSettings(r.Context(), request.Features)
	if err != nil {
		writeAIError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, settings)
}

func (a *App) handleSuggestCommitMessage(w http.ResponseWriter, r *http.Request) {
	if !allowMethod(w, r, http.MethodPost) {
		return
	}

	suggestion, err := a.aiService.SuggestCommitMessage(r.Context())
	if err != nil {
		writeAIError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, suggestion)
}

func writeAIError(w http.ResponseWriter, err error) {
	var providerValidationErr *ai.FeatureProviderValidationError
	var providerNotConfiguredErr *ai.FeatureProviderNotConfiguredError
	var noStagedErr *ai.NoStagedChangesInScopeError
	var hiddenScopedErr *ai.HiddenScopedStagedChangesError

	switch {
	case errors.As(err, &providerValidationErr):
		http.Error(w, err.Error(), http.StatusBadRequest)
	case errors.As(err, &providerNotConfiguredErr):
		http.Error(w, err.Error(), http.StatusConflict)
	case errors.As(err, &noStagedErr), errors.As(err, &hiddenScopedErr):
		http.Error(w, err.Error(), http.StatusConflict)
	default:
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}
