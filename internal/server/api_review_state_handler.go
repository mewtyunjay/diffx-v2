package server

import "net/http"

func (a *App) handleReviewState(w http.ResponseWriter, r *http.Request) {
	if !allowMethod(w, r, http.MethodGet) {
		return
	}

	writeJSON(w, http.StatusOK, a.ReviewState())
}
