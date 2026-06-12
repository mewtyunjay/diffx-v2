package server

import (
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"diffx/internal/gitstatus"
)

func TestWriteAPIErrorMapsToStatus(t *testing.T) {
	cases := []struct {
		name string
		err  error
		want int
	}{
		{"invalid base ref", gitstatus.ErrInvalidBaseRef, http.StatusBadRequest},
		{"empty commit message", gitstatus.ErrEmptyCommitMessage, http.StatusBadRequest},
		{"path outside scope", gitstatus.ErrPathOutsideScope, http.StatusBadRequest},
		{"bulk action not at root", gitstatus.ErrBulkActionNotAtRoot, http.StatusBadRequest},
		{"path required", gitstatus.ErrPathRequired, http.StatusBadRequest},
		{"branch required", gitstatus.ErrBranchRequired, http.StatusBadRequest},
		{"absolute path", gitstatus.ErrAbsolutePath, http.StatusBadRequest},
		{"path escapes repo", fmt.Errorf("%w: %q", gitstatus.ErrPathEscapesRepo, "../etc"), http.StatusBadRequest},
		{"not a file", fmt.Errorf("%w: %q", gitstatus.ErrNotAFile, "dir"), http.StatusBadRequest},
		{"no staged changes", gitstatus.ErrNoStagedChanges, http.StatusConflict},
		{"detached head", gitstatus.ErrDetachedHead, http.StatusConflict},
		{"uncommitted changes", gitstatus.ErrUncommittedChanges, http.StatusConflict},
		{"scoped commit blocked", &gitstatus.ScopedCommitBlockedError{HiddenStagedFileCount: 2}, http.StatusConflict},
		{"wrapped path required", fmt.Errorf("read file diff: %w", gitstatus.ErrPathRequired), http.StatusBadRequest},
		{"unknown error", errors.New("git exploded"), http.StatusInternalServerError},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			writeAPIError(recorder, tc.err)
			if recorder.Code != tc.want {
				t.Fatalf("status = %d, want %d", recorder.Code, tc.want)
			}
		})
	}
}
