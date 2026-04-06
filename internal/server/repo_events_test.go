package server

import (
	"bufio"
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

	server := httptest.NewServer(app.Handler())
	defer server.Close()
	defer app.Close()

	response, err := server.Client().Get(server.URL + "/api/events")
	if err != nil {
		t.Fatalf("GET /api/events returned error: %v", err)
	}
	defer response.Body.Close()

	if got := response.Header.Get("Content-Type"); !strings.Contains(got, "text/event-stream") {
		t.Fatalf("expected text/event-stream content type, got %q", got)
	}
	if got := response.Header.Get("Cache-Control"); got != "no-cache" {
		t.Fatalf("expected Cache-Control no-cache, got %q", got)
	}

	app.repoEvents.Publish(repoChangedEvent{Kind: repoChangeWorktree})

	reader := bufio.NewReader(response.Body)
	lines := make([]string, 0, 4)
	deadline := time.Now().Add(3 * time.Second)

	for time.Now().Before(deadline) {
		line, readErr := reader.ReadString('\n')
		if readErr != nil {
			t.Fatalf("read stream line: %v", readErr)
		}

		lines = append(lines, strings.TrimRight(line, "\n"))
		if strings.HasPrefix(line, "data: ") {
			break
		}
	}

	body := strings.Join(lines, "\n")
	if !strings.Contains(body, "event: repo-changed") {
		t.Fatalf("expected repo-changed event, got %q", body)
	}
	if !strings.Contains(body, `"kind":"worktree"`) {
		t.Fatalf("expected worktree payload, got %q", body)
	}
}
