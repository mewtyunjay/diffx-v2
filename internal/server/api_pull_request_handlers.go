package server

import (
	"errors"
	"fmt"
	"net/http"
	"strconv"

	githubservice "diffx/internal/github"
	"diffx/internal/gitstatus"
)

type pullRequestDetailResponse struct {
	Kind              string                                  `json:"kind"`
	PR                githubservice.PullRequestDetail         `json:"pr"`
	Repo              githubservice.Repository                `json:"repo"`
	Base              githubservice.PullRequestRef            `json:"base"`
	Head              githubservice.PullRequestRef            `json:"head"`
	Merge             githubservice.PullRequestMergeState     `json:"merge"`
	Checks            githubservice.PullRequestChecksSummary  `json:"checks"`
	Reviews           githubservice.PullRequestReviewsSummary `json:"reviews"`
	Commits           []githubservice.CommitItem              `json:"commits"`
	Files             []gitstatus.ChangedFileItem             `json:"files"`
	LocalDiff         *pullRequestLocalDiffState              `json:"localDiff,omitempty"`
	OutsideScopeCount int                                     `json:"outsideScopeCount,omitempty"`
	ScopePath         string                                  `json:"scopePath"`
}

type pullRequestLocalDiffState struct {
	Status  string `json:"status"`
	Message string `json:"message"`
}

type approvePullRequestRequest struct {
	Number int    `json:"number"`
	Body   string `json:"body,omitempty"`
}

type mergePullRequestRequest struct {
	Number int    `json:"number"`
	Method string `json:"method,omitempty"`
}

func (a *App) handlePullRequests(w http.ResponseWriter, r *http.Request) {
	if !allowMethod(w, r, http.MethodGet) {
		return
	}

	result, err := a.githubService.ListOpenPullRequests(r.Context())
	if err != nil {
		writeGitHubAPIError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, result)
}

func (a *App) handlePullRequestDetail(w http.ResponseWriter, r *http.Request) {
	if !allowMethod(w, r, http.MethodGet) {
		return
	}

	number, ok := readPullRequestNumber(w, r)
	if !ok {
		return
	}

	metadata, err := a.githubService.ReadPullRequestMetadata(r.Context(), number)
	if err != nil {
		writeGitHubAPIError(w, err)
		return
	}

	response := pullRequestDetailResponse{
		Kind:      "pull-request",
		PR:        metadata.PR,
		Repo:      metadata.Repo,
		Base:      metadata.Base,
		Head:      metadata.Head,
		Merge:     metadata.Merge,
		Checks:    metadata.Checks,
		Reviews:   metadata.Reviews,
		Commits:   metadata.Commits,
		Files:     []gitstatus.ChangedFileItem{},
		ScopePath: a.service.ScopePath(),
	}

	diffResult, err := a.service.ReadPullRequestDiff(r.Context(), metadataToGitstatusRefs(metadata))
	if err != nil {
		response.LocalDiff = &pullRequestLocalDiffState{
			Status:  "local_diff_failed",
			Message: fmt.Sprintf("PR metadata loaded, but DiffX could not fetch local Git objects for the diff. %s", err.Error()),
		}
		writeJSON(w, http.StatusOK, response)
		return
	}

	response.Files = diffResult.Files
	response.OutsideScopeCount = diffResult.OutsideScopeCount
	response.ScopePath = diffResult.ScopePath
	writeJSON(w, http.StatusOK, response)
}

func (a *App) handlePullRequestFileDiff(w http.ResponseWriter, r *http.Request) {
	if !allowMethod(w, r, http.MethodGet) {
		return
	}

	number, ok := readPullRequestNumber(w, r)
	if !ok {
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

	metadata, err := a.githubService.ReadPullRequestMetadata(r.Context(), number)
	if err != nil {
		writeGitHubAPIError(w, err)
		return
	}

	result, err := a.service.ReadPullRequestFileDiff(
		r.Context(),
		metadataToGitstatusRefs(metadata),
		path,
		status,
		previousPath,
	)
	if err != nil {
		writeAPIError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, result)
}

func (a *App) handleApprovePullRequest(w http.ResponseWriter, r *http.Request) {
	if !allowMethod(w, r, http.MethodPost) {
		return
	}

	var request approvePullRequestRequest
	if err := readJSONBody(r, &request); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if request.Number <= 0 {
		http.Error(w, "pull request number is required", http.StatusBadRequest)
		return
	}

	if err := a.githubService.ApprovePullRequest(r.Context(), request.Number, request.Body); err != nil {
		writeGitHubAPIError(w, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (a *App) handleMergePullRequest(w http.ResponseWriter, r *http.Request) {
	if !allowMethod(w, r, http.MethodPost) {
		return
	}

	var request mergePullRequestRequest
	if err := readJSONBody(r, &request); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if request.Number <= 0 {
		http.Error(w, "pull request number is required", http.StatusBadRequest)
		return
	}
	if request.Method != "" && request.Method != "merge" && request.Method != "squash" && request.Method != "rebase" {
		http.Error(w, fmt.Sprintf("invalid merge method %q", request.Method), http.StatusBadRequest)
		return
	}

	if err := a.githubService.MergePullRequest(r.Context(), request.Number, request.Method); err != nil {
		writeGitHubAPIError(w, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func readPullRequestNumber(w http.ResponseWriter, r *http.Request) (int, bool) {
	rawNumber := r.URL.Query().Get("number")
	if rawNumber == "" {
		http.Error(w, "pull request number is required", http.StatusBadRequest)
		return 0, false
	}

	number, err := strconv.Atoi(rawNumber)
	if err != nil || number <= 0 {
		http.Error(w, "pull request number must be a positive integer", http.StatusBadRequest)
		return 0, false
	}

	return number, true
}

func metadataToGitstatusRefs(metadata githubservice.PullRequestDetailMetadata) gitstatus.PullRequestRefs {
	return gitstatus.PullRequestRefs{
		Number:              metadata.PR.Number,
		BaseRefName:         metadata.Base.RefName,
		BaseSHA:             metadata.Base.SHA,
		HeadRefName:         metadata.Head.RefName,
		HeadSHA:             metadata.Head.SHA,
		HeadRepositoryOwner: metadata.Head.RepositoryOwner,
		HeadRepositoryName:  metadata.Head.RepositoryName,
	}
}

func writeGitHubAPIError(w http.ResponseWriter, err error) {
	var integrationErr *githubservice.IntegrationError
	if errors.As(err, &integrationErr) {
		status := http.StatusInternalServerError
		switch integrationErr.State.Status {
		case githubservice.IntegrationGHMissing,
			githubservice.IntegrationGHUnauthed,
			githubservice.IntegrationRepoUnresolved,
			githubservice.IntegrationMergeBlocked:
			status = http.StatusConflict
		case githubservice.IntegrationPermissionDenied:
			status = http.StatusForbidden
		case githubservice.IntegrationNotFound:
			status = http.StatusNotFound
		}

		http.Error(w, integrationErr.State.Message, status)
		return
	}

	writeAPIError(w, err)
}
