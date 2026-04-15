package server

import "net/http"

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
	RemoteRef       string `json:"remoteRef"`
	CreatedUpstream bool   `json:"createdUpstream"`
}

type resolveConflictRequest struct {
	Path     string `json:"path"`
	Contents string `json:"contents"`
}

type checkoutBranchRequest struct {
	Branch string `json:"branch"`
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

	result, err := a.service.PushCurrentBranch(r.Context())
	if err != nil {
		writeAPIError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, pushResponse{
		RemoteRef:       result.RemoteRef,
		CreatedUpstream: result.CreatedUpstream,
	})
}

func (a *App) handleFetch(w http.ResponseWriter, r *http.Request) {
	if !allowMethod(w, r, http.MethodPost) {
		return
	}

	if err := a.service.FetchRemote(r.Context()); err != nil {
		writeAPIError(w, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (a *App) handlePull(w http.ResponseWriter, r *http.Request) {
	if !allowMethod(w, r, http.MethodPost) {
		return
	}

	if err := a.service.PullCurrentBranch(r.Context()); err != nil {
		writeAPIError(w, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (a *App) handleCheckoutBranch(w http.ResponseWriter, r *http.Request) {
	if !allowMethod(w, r, http.MethodPost) {
		return
	}

	var request checkoutBranchRequest
	if err := readJSONBody(r, &request); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if request.Branch == "" {
		http.Error(w, "branch is required", http.StatusBadRequest)
		return
	}

	if err := a.service.CheckoutBranch(r.Context(), request.Branch); err != nil {
		writeAPIError(w, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (a *App) handleConflictFile(w http.ResponseWriter, r *http.Request) {
	if !allowMethod(w, r, http.MethodGet) {
		return
	}

	path := r.URL.Query().Get("path")
	if path == "" {
		http.Error(w, "path is required", http.StatusBadRequest)
		return
	}
	if !a.service.AllowsDiff(path, "") {
		http.Error(w, "path is outside the current workspace scope", http.StatusBadRequest)
		return
	}

	result, err := a.service.ReadConflictFile(path)
	if err != nil {
		writeAPIError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, result)
}

func (a *App) handleResolveConflict(w http.ResponseWriter, r *http.Request) {
	if !allowMethod(w, r, http.MethodPost) {
		return
	}

	var request resolveConflictRequest
	if err := readJSONBody(r, &request); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if request.Path == "" {
		http.Error(w, "path is required", http.StatusBadRequest)
		return
	}
	if !a.service.AllowsDiff(request.Path, "") {
		http.Error(w, "path is outside the current workspace scope", http.StatusBadRequest)
		return
	}

	result, err := a.service.ResolveConflictFile(request.Path, request.Contents)
	if err != nil {
		writeAPIError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, result)
}
