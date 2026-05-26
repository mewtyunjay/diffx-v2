package server

import (
	"net/http"

	"diffx/internal/userconfig"
)

type diffViewerPreferencesRequest struct {
	Preferences userconfig.DiffViewerPreferences `json:"preferences"`
}

func (a *App) handleDiffViewerPreferences(w http.ResponseWriter, r *http.Request) {
	if !allowMethod(w, r, http.MethodGet) {
		return
	}

	preferences, err := a.userConfigStore.LoadDiffViewerPreferences()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, preferences)
}

func (a *App) handleUpdateDiffViewerPreferences(w http.ResponseWriter, r *http.Request) {
	if !allowMethod(w, r, http.MethodPost) {
		return
	}

	var request diffViewerPreferencesRequest
	if err := readJSONBody(r, &request); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	preferences, err := a.userConfigStore.SaveDiffViewerPreferences(request.Preferences)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, preferences)
}
