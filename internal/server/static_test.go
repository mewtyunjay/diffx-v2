package server

import (
	"io/fs"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"testing/fstest"

	"diffx/internal/gitstatus"
)

func TestStaticHandlerServesIndexForRoutes(t *testing.T) {
	t.Parallel()

	app := newTestApp(t)
	request := httptest.NewRequest(http.MethodGet, "/experimental/sidebar", nil)
	recorder := httptest.NewRecorder()

	app.staticHandler().ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", recorder.Code)
	}
	if !strings.Contains(recorder.Body.String(), `<div id="root"></div>`) {
		t.Fatalf("expected index.html body, got %q", recorder.Body.String())
	}
}

func TestStaticHandlerReturnsNotFoundForMissingAssets(t *testing.T) {
	t.Parallel()

	app := newTestApp(t)
	request := httptest.NewRequest(http.MethodGet, "/assets/missing.js", nil)
	recorder := httptest.NewRecorder()

	app.staticHandler().ServeHTTP(recorder, request)

	if recorder.Code != http.StatusNotFound {
		t.Fatalf("expected status 404, got %d", recorder.Code)
	}
}

func newTestApp(t *testing.T) *App {
	t.Helper()

	repoRoot := createServerActionRepo(t)
	app, err := newWithAssets(
		Config{
			Workspace: gitstatus.WorkspaceTarget{
				RepoRoot:  repoRoot,
				ScopePath: ".",
			},
		},
		testAssets(),
	)
	if err != nil {
		t.Fatalf("newWithAssets returned error: %v", err)
	}
	t.Cleanup(func() {
		if err := app.Close(); err != nil {
			t.Fatalf("close app: %v", err)
		}
	})

	return app
}

func testAssets() fs.FS {
	return fstest.MapFS{
		"dist/index.html": &fstest.MapFile{
			Data: []byte("<!doctype html><html><body><div id=\"root\"></div></body></html>"),
		},
		"dist/assets/app.js": &fstest.MapFile{
			Data: []byte("console.log('ok')"),
		},
	}
}
