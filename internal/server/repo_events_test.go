package server

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestHandleEventsRejectsNonGet(t *testing.T) {
	t.Parallel()

	app := &App{
		repoEvents:      newRepoEventHub(),
		frontendHandler: http.NotFoundHandler(),
	}

	request := httptest.NewRequest(http.MethodPost, "/api/events", nil)
	recorder := httptest.NewRecorder()

	app.Handler().ServeHTTP(recorder, request)

	if recorder.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected status 405, got %d", recorder.Code)
	}
}

func TestHandleEventsStreamsRepoChangedEvents(t *testing.T) {
	t.Parallel()

	app := &App{
		repoEvents:      newRepoEventHub(),
		frontendHandler: http.NotFoundHandler(),
	}
	defer app.Close()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	request := httptest.NewRequest(http.MethodGet, "/api/events", nil).WithContext(ctx)
	recorder := httptest.NewRecorder()
	done := make(chan struct{})

	go func() {
		app.Handler().ServeHTTP(recorder, request)
		close(done)
	}()

	time.Sleep(25 * time.Millisecond)
	app.repoEvents.Publish(repoChangedEvent{Kind: repoChangeWorktree})
	time.Sleep(25 * time.Millisecond)
	cancel()

	select {
	case <-done:
	case <-time.After(3 * time.Second):
		t.Fatal("timed out waiting for SSE handler to exit")
	}

	if got := recorder.Header().Get("Content-Type"); !strings.Contains(got, "text/event-stream") {
		t.Fatalf("expected text/event-stream content type, got %q", got)
	}
	if got := recorder.Header().Get("Cache-Control"); got != "no-cache" {
		t.Fatalf("expected Cache-Control no-cache, got %q", got)
	}

	body := recorder.Body.String()
	if !strings.Contains(body, "event: repo-changed") {
		t.Fatalf("expected repo-changed event, got %q", body)
	}
	if !strings.Contains(body, `"kind":"worktree"`) {
		t.Fatalf("expected worktree payload, got %q", body)
	}
}
