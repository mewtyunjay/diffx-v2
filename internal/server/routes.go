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
	mux.HandleFunc("/api/feedback", a.handleReviewFeedback)
	mux.HandleFunc("/api/review/state", a.handleReviewState)
	mux.Handle("/", a.frontend())
}
