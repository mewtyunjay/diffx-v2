package server

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"

	"diffx/internal/gitstatus"
)

type stageFileRequest struct {
	Path         string `json:"path"`
	PreviousPath string `json:"previousPath,omitempty"`
}

type commitRequest struct {
	Message string `json:"message"`
}

type commitResponse struct {
	Commit string `json:"commit"`
}

type pushResponse struct {
	RemoteRef string `json:"remoteRef"`
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

func (a *App) handleStageFile(w http.ResponseWriter, r *http.Request) {
	if !allowMethod(w, r, http.MethodPost) {
		return
	}

	var request stageFileRequest
	if err := readJSONBody(r, &request); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if err := a.service.StageFile(r.Context(), request.Path, request.PreviousPath); err != nil {
		writeAPIError(w, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (a *App) handleStageAll(w http.ResponseWriter, r *http.Request) {
	if !allowMethod(w, r, http.MethodPost) {
		return
	}

	if err := a.service.StageAll(r.Context()); err != nil {
		writeAPIError(w, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (a *App) handleUnstageFile(w http.ResponseWriter, r *http.Request) {
	if !allowMethod(w, r, http.MethodPost) {
		return
	}

	var request stageFileRequest
	if err := readJSONBody(r, &request); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if err := a.service.UnstageFile(r.Context(), request.Path, request.PreviousPath); err != nil {
		writeAPIError(w, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (a *App) handleUnstageAll(w http.ResponseWriter, r *http.Request) {
	if !allowMethod(w, r, http.MethodPost) {
		return
	}

	if err := a.service.UnstageAll(r.Context()); err != nil {
		writeAPIError(w, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (a *App) handleCommit(w http.ResponseWriter, r *http.Request) {
	if !allowMethod(w, r, http.MethodPost) {
		return
	}

	var request commitRequest
	if err := readJSONBody(r, &request); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	commit, err := a.service.CommitStaged(r.Context(), request.Message)
	if err != nil {
		writeAPIError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, commitResponse{Commit: commit})
}

func (a *App) handlePush(w http.ResponseWriter, r *http.Request) {
	if !allowMethod(w, r, http.MethodPost) {
		return
	}

	remoteRef, err := a.service.PushCurrentBranch(r.Context())
	if err != nil {
		writeAPIError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, pushResponse{RemoteRef: remoteRef})
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

func readJSONBody(r *http.Request, destination any) error {
	defer r.Body.Close()

	decoder := json.NewDecoder(io.LimitReader(r.Body, 1<<20))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(destination); err != nil {
		return fmt.Errorf("invalid JSON body: %w", err)
	}

	if err := decoder.Decode(new(struct{})); err != io.EOF {
		if err == nil {
			return fmt.Errorf("invalid JSON body: multiple JSON values are not allowed")
		}
		return fmt.Errorf("invalid JSON body: %w", err)
	}

	return nil
}

func writeAPIError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, gitstatus.ErrInvalidBaseRef):
		http.Error(w, err.Error(), http.StatusBadRequest)
	case errors.Is(err, gitstatus.ErrEmptyCommitMessage), errors.Is(err, gitstatus.ErrPathOutsideScope), errors.Is(err, gitstatus.ErrBulkActionNotAtRoot):
		http.Error(w, err.Error(), http.StatusBadRequest)
	case errors.Is(err, gitstatus.ErrNoStagedChanges), errors.Is(err, gitstatus.ErrDetachedHead):
		http.Error(w, err.Error(), http.StatusConflict)
	default:
		var scopedCommitErr *gitstatus.ScopedCommitBlockedError
		if errors.As(err, &scopedCommitErr) {
			http.Error(w, err.Error(), http.StatusConflict)
			return
		}

		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}
