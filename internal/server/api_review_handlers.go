package server

import (
	"errors"
	"net/http"
)

type reviewFeedbackRequest struct {
	Approved    bool   `json:"approved"`
	Feedback    string `json:"feedback"`
	Annotations []any  `json:"annotations,omitempty"`
}

func (a *App) handleReviewFeedback(w http.ResponseWriter, r *http.Request) {
	if !allowMethod(w, r, http.MethodPost) {
		return
	}
	if !a.ReviewModeEnabled() {
		http.Error(w, "review feedback is not enabled", http.StatusNotFound)
		return
	}

	var request reviewFeedbackRequest
	if err := readJSONBody(r, &request); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if err := a.SubmitReviewFeedback(ReviewFeedback{
		Approved:    request.Approved,
		Feedback:    request.Feedback,
		Annotations: request.Annotations,
	}); err != nil {
		switch {
		case errors.Is(err, ErrReviewFeedbackAlreadySubmitted):
			http.Error(w, err.Error(), http.StatusConflict)
		case errors.Is(err, ErrReviewFeedbackDisabled):
			http.Error(w, err.Error(), http.StatusNotFound)
		default:
			http.Error(w, err.Error(), http.StatusInternalServerError)
		}
		return
	}

	writeJSON(w, http.StatusAccepted, map[string]bool{"ok": true})
}
