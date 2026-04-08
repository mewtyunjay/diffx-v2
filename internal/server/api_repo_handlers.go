package server

import (
	"fmt"
	"net/http"

	"diffx/internal/gitstatus"
)

func (a *App) handleBranches(w http.ResponseWriter, r *http.Request) {
	if !allowMethod(w, r, http.MethodGet) {
		return
	}

	result, err := a.service.ListBranches(r.Context())
	if err != nil {
		writeAPIError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, result)
}

func (a *App) handleFiles(w http.ResponseWriter, r *http.Request) {
	if !allowMethod(w, r, http.MethodGet) {
		return
	}

	result, err := a.service.ListChangedFiles(r.Context(), r.URL.Query().Get("baseRef"))
	if err != nil {
		writeAPIError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, result)
}

func (a *App) handleFileDiff(w http.ResponseWriter, r *http.Request) {
	if !allowMethod(w, r, http.MethodGet) {
		return
	}

	query := r.URL.Query()
	path := query.Get("path")
	if path == "" {
		http.Error(w, "path is required", http.StatusBadRequest)
		return
	}

	status := gitstatus.ChangedFileStatus(query.Get("status"))
	if !status.IsValid() {
		http.Error(w, fmt.Sprintf("invalid status %q", status), http.StatusBadRequest)
		return
	}

	previousPath := query.Get("previousPath")
	if !a.service.AllowsDiff(path, previousPath) {
		http.Error(w, "path is outside the current workspace scope", http.StatusBadRequest)
		return
	}

	result, err := a.service.ReadFileDiff(r.Context(), path, status, previousPath, query.Get("baseRef"))
	if err != nil {
		writeAPIError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, result)
}
