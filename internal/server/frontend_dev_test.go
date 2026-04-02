package server

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"diffx/internal/gitstatus"
)

func TestShouldUseFrontendDev(t *testing.T) {
	t.Parallel()

	workingDir := t.TempDir()
	frontendDir := filepath.Join(workingDir, "frontend")
	if err := os.Mkdir(frontendDir, 0o755); err != nil {
		t.Fatalf("mkdir frontend: %v", err)
	}
	if err := os.WriteFile(filepath.Join(frontendDir, "package.json"), []byte("{}"), 0o644); err != nil {
		t.Fatalf("write package.json: %v", err)
	}

	if !shouldUseFrontendDev(FrontendConfig{
		WorkingDir: workingDir,
		DevURL:     "http://127.0.0.1:5173",
	}) {
		t.Fatal("expected source checkout to enable frontend dev mode")
	}

	if shouldUseFrontendDev(FrontendConfig{
		Static:     true,
		WorkingDir: workingDir,
		DevURL:     "http://127.0.0.1:5173",
	}) {
		t.Fatal("expected --static to disable frontend dev mode")
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

	request := httptest.NewRequest(http.MethodGet, "/experimental/sidebar", nil)
	recorder := httptest.NewRecorder()

	app.Handler().ServeHTTP(recorder, request)

	if recorder.Code != http.StatusCreated {
		t.Fatalf("expected status 201, got %d", recorder.Code)
	}
	if body := recorder.Body.String(); body != "frontend" {
		t.Fatalf("expected frontend response body, got %q", body)
	}
	if got := recorder.Header().Get("X-Frontend-Path"); got != "/experimental/sidebar" {
		t.Fatalf("expected proxied path /experimental/sidebar, got %q", got)
	}
}

func newFrontendDevTestApp(t *testing.T, frontendHandler http.Handler) *App {
	t.Helper()

	return &App{
		service:         gitstatus.NewService("/tmp/repo", "."),
		frontendHandler: frontendHandler,
	}
}
