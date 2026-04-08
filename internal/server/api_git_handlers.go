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
	RemoteRef string `json:"remoteRef"`
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
