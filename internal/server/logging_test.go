package server

import (
	"bytes"
	"log"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestLogAPIMiddlewareLogsStatusCodes(t *testing.T) {
	var output bytes.Buffer
	app := &App{
		apiLogger: log.New(&output, "", 0),
	}

	handler := app.logAPIMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))

	request := httptest.NewRequest(http.MethodPost, "/api/git/stage-all", nil)
	recorder := httptest.NewRecorder()

	handler.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusNoContent {
		t.Fatalf("expected 204 response, got %d", recorder.Code)
	}

	logged := output.String()
	if !strings.Contains(logged, "POST /api/git/stage-all -> 204") {
		t.Fatalf("expected success log entry, got %q", logged)
	}
}

func TestLogAPIMiddlewareLogsErrorBody(t *testing.T) {
	var output bytes.Buffer
	app := &App{
		apiLogger: log.New(&output, "", 0),
	}

	handler := app.logAPIMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "fatal: Unable to create '/tmp/repo/.git/index.lock': File exists.", http.StatusInternalServerError)
	}))

	request := httptest.NewRequest(http.MethodPost, "/api/git/stage-all", nil)
	recorder := httptest.NewRecorder()

	handler.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500 response, got %d", recorder.Code)
	}

	logged := output.String()
	if !strings.Contains(logged, "POST /api/git/stage-all -> 500") {
		t.Fatalf("expected error status in log entry, got %q", logged)
	}
	if !strings.Contains(logged, `error="fatal: Unable to create '/tmp/repo/.git/index.lock': File exists."`) {
		t.Fatalf("expected error body in log entry, got %q", logged)
	}
}

func TestLogAPIMiddlewareSkipsNonAPIRequests(t *testing.T) {
	var output bytes.Buffer
	app := &App{
		apiLogger: log.New(&output, "", 0),
	}

	handler := app.logAPIMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	request := httptest.NewRequest(http.MethodGet, "/", nil)
	recorder := httptest.NewRecorder()

	handler.ServeHTTP(recorder, request)

	if output.Len() != 0 {
		t.Fatalf("expected no log output for non-api request, got %q", output.String())
	}
}
