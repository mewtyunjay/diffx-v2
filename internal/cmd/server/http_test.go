package main

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"diffx/gitstatus"
)

func TestResolveStaticPathRejectsTraversal(t *testing.T) {
	t.Parallel()

	webRoot := t.TempDir()
	if _, err := resolveStaticPath(webRoot, "../secret.txt"); err == nil {
		t.Fatal("expected traversal to be rejected")
	}
}

func TestStaticHandlerFallsBackToIndexHTML(t *testing.T) {
	t.Parallel()

	webRoot := t.TempDir()
	indexPath := filepath.Join(webRoot, "index.html")
	if err := os.WriteFile(indexPath, []byte("hello from diffx"), 0o644); err != nil {
		t.Fatalf("write index.html: %v", err)
	}

	request := httptest.NewRequest(http.MethodGet, "/files/anything", nil)
	recorder := httptest.NewRecorder()

	staticHandler(webRoot).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", recorder.Code)
	}
	if body := recorder.Body.String(); body != "hello from diffx" {
		t.Fatalf("expected SPA fallback body, got %q", body)
	}
}

func TestFileDiffHandlerRejectsOutOfScopeRequests(t *testing.T) {
	t.Parallel()

	service := gitstatus.NewService(t.TempDir(), "frontend/src")
	request := httptest.NewRequest(http.MethodGet, "/api/file-diff?path=docs/README.md&status=modified", nil)
	recorder := httptest.NewRecorder()

	fileDiffHandler(service).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusForbidden {
		t.Fatalf("expected 403 for out-of-scope diff request, got %d", recorder.Code)
	}
}
