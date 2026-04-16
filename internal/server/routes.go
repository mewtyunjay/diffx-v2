package server

import "net/http"

func (a *App) registerRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/branches", a.handleBranches)
	mux.HandleFunc("/api/files", a.handleFiles)
	mux.HandleFunc("/api/file-diff", a.handleFileDiff)
	mux.HandleFunc("/api/events", a.handleEvents)
	mux.HandleFunc("/api/git/stage", a.handleStageFile)
	mux.HandleFunc("/api/git/stage-all", a.handleStageAll)
	mux.HandleFunc("/api/git/unstage", a.handleUnstageFile)
	mux.HandleFunc("/api/git/unstage-all", a.handleUnstageAll)
	mux.HandleFunc("/api/git/commit", a.handleCommit)
	mux.HandleFunc("/api/git/push", a.handlePush)
	mux.HandleFunc("/api/git/fetch", a.handleFetch)
	mux.HandleFunc("/api/git/pull", a.handlePull)
	mux.HandleFunc("/api/git/checkout", a.handleCheckoutBranch)
	mux.HandleFunc("/api/git/conflict-file", a.handleConflictFile)
	mux.HandleFunc("/api/git/conflict/resolve", a.handleResolveConflict)
	mux.HandleFunc("/api/ai/agents", a.handleAIAgents)
	mux.HandleFunc("/api/ai/agents/refresh", a.handleRefreshAIAgents)
	mux.HandleFunc("/api/ai/settings", a.handleAISettings)
	mux.HandleFunc("/api/ai/settings/update", a.handleUpdateAISettings)
	mux.HandleFunc("/api/ai/features/commit-message/suggest", a.handleSuggestCommitMessage)
	mux.HandleFunc("/api/feedback", a.handleReviewFeedback)
	mux.HandleFunc("/api/review/state", a.handleReviewState)
	mux.Handle("/", a.frontend())
}
