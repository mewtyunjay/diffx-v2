package server

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"diffx/internal/gitstatus"
)

func TestShouldUseFrontendDev(t *testing.T) {
	t.Parallel()

	if !shouldUseFrontendDev(FrontendConfig{
		Dev:    true,
		DevURL: "http://127.0.0.1:5173",
	}) {
		t.Fatal("expected --dev to enable frontend dev mode")
	}

	if shouldUseFrontendDev(FrontendConfig{
		Dev:    false,
		DevURL: "http://127.0.0.1:5173",
	}) {
		t.Fatal("expected default (no --dev) to disable frontend dev mode")
	}

	if shouldUseFrontendDev(FrontendConfig{
		Dev:    true,
		DevURL: "",
	}) {
		t.Fatal("expected empty DevURL to disable frontend dev mode even with --dev")
	}
}

func TestAppHandlerKeepsAPIOnGoInFrontendDevMode(t *testing.T) {
	t.Parallel()

	app := newFrontendDevTestApp(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusCreated)
		_, _ = w.Write([]byte("frontend"))
	}))

	request := httptest.NewRequest(http.MethodGet, "/api/file-diff", nil)
	recorder := httptest.NewRecorder()

	app.Handler().ServeHTTP(recorder, request)

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d", recorder.Code)
	}
	if !strings.Contains(recorder.Body.String(), "path is required") {
		t.Fatalf("expected API response body, got %q", recorder.Body.String())
	}
}

func TestAppHandlerProxiesFrontendRoutesInDevMode(t *testing.T) {
	t.Parallel()

	app := newFrontendDevTestApp(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Frontend-Path", r.URL.Path)
		w.WriteHeader(http.StatusCreated)
		_, _ = w.Write([]byte("frontend"))
	}))

	request := httptest.NewRequest(http.MethodGet, "/app", nil)
	recorder := httptest.NewRecorder()

	app.Handler().ServeHTTP(recorder, request)

	if recorder.Code != http.StatusCreated {
		t.Fatalf("expected status 201, got %d", recorder.Code)
	}
	if body := recorder.Body.String(); body != "frontend" {
		t.Fatalf("expected frontend response body, got %q", body)
	}
	if got := recorder.Header().Get("X-Frontend-Path"); got != "/app" {
		t.Fatalf("expected proxied path /app, got %q", got)
	}
}

func newFrontendDevTestApp(t *testing.T, frontendHandler http.Handler) *App {
	t.Helper()

	return &App{
		service:         gitstatus.NewService("/tmp/repo", "."),
		frontendHandler: frontendHandler,
	}
}
