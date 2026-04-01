package server

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"

	"diffx/internal/gitstatus"
)

type helloResponse struct {
	Status    string `json:"status"`
	RepoRoot  string `json:"repoRoot"`
	ScopePath string `json:"scopePath"`
}

func (a *App) handleHello(w http.ResponseWriter, r *http.Request) {
	if !allowMethod(w, r, http.MethodGet) {
		return
	}

	writeJSON(w, http.StatusOK, helloResponse{
		Status:    "ok",
		RepoRoot:  a.workspace.RepoRoot,
		ScopePath: a.workspace.ScopePath,
	})
}

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

func allowMethod(w http.ResponseWriter, r *http.Request, method string) bool {
	if r.Method == method {
		return true
	}

	w.Header().Set("Allow", method)
	http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	return false
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func writeAPIError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, gitstatus.ErrInvalidBaseRef):
		http.Error(w, err.Error(), http.StatusBadRequest)
	default:
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}
