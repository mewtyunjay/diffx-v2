package server

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"

	"diffx/internal/gitstatus"
)

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
