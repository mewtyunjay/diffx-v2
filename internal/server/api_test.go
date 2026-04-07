package server

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"diffx/internal/gitstatus"
)

func TestHandleStageFileStagesChanges(t *testing.T) {
	t.Parallel()

	repoRoot := createServerActionRepo(t)
	writeServerTestFile(t, filepath.Join(repoRoot, "notes.txt"), "base\nupdated\n")
	app := newRepoBackedTestApp(t, repoRoot, ".")

	request := httptest.NewRequest(http.MethodPost, "/api/git/stage", bytes.NewBufferString(`{"path":"notes.txt"}`))
	request.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()

	app.Handler().ServeHTTP(recorder, request)

	if recorder.Code != http.StatusNoContent {
		t.Fatalf("expected status 204, got %d: %s", recorder.Code, recorder.Body.String())
	}

	result, err := app.service.ListChangedFiles(request.Context(), "HEAD")
	if err != nil {
		t.Fatalf("ListChangedFiles returned error: %v", err)
	}
	if len(result.Files) != 1 || !result.Files[0].HasStagedChanges {
		t.Fatalf("expected notes.txt to be staged, got %#v", result.Files)
	}
}

func TestHandleStageFileRejectsUnknownFields(t *testing.T) {
	t.Parallel()

	repoRoot := createServerActionRepo(t)
	writeServerTestFile(t, filepath.Join(repoRoot, "notes.txt"), "base\nupdated\n")
	app := newRepoBackedTestApp(t, repoRoot, ".")

	request := httptest.NewRequest(
		http.MethodPost,
		"/api/git/stage",
		bytes.NewBufferString(`{"path":"notes.txt","displayPath":"notes.txt"}`),
	)
	request.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()

	app.Handler().ServeHTTP(recorder, request)

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d: %s", recorder.Code, recorder.Body.String())
	}
	if !strings.Contains(recorder.Body.String(), "invalid JSON body") {
		t.Fatalf("expected invalid JSON body error, got %q", recorder.Body.String())
	}
}

func TestHandleStageAllStagesRepoRootChanges(t *testing.T) {
	t.Parallel()

	repoRoot := createServerActionRepo(t)
	writeServerTestFile(t, filepath.Join(repoRoot, "notes.txt"), "base\nupdated\n")
	writeServerTestFile(t, filepath.Join(repoRoot, "fresh.txt"), "fresh\n")
	app := newRepoBackedTestApp(t, repoRoot, ".")

	request := httptest.NewRequest(http.MethodPost, "/api/git/stage-all", nil)
	recorder := httptest.NewRecorder()

	app.Handler().ServeHTTP(recorder, request)

	if recorder.Code != http.StatusNoContent {
		t.Fatalf("expected status 204, got %d: %s", recorder.Code, recorder.Body.String())
	}

	result, err := app.service.ListChangedFiles(request.Context(), "HEAD")
	if err != nil {
		t.Fatalf("ListChangedFiles returned error: %v", err)
	}
	if len(result.Files) != 2 {
		t.Fatalf("expected 2 changed files, got %#v", result.Files)
	}
	for _, file := range result.Files {
		if !file.HasStagedChanges || file.HasUnstagedChanges {
			t.Fatalf("expected fully staged files, got %#v", result.Files)
		}
	}
}

func TestHandleUnstageAllRejectsSubfolderScope(t *testing.T) {
	t.Parallel()

	repoRoot := createServerActionRepo(t)
	writeServerTestFile(t, filepath.Join(repoRoot, "frontend", "app.tsx"), "export const app = 2\n")
	runServerGit(t, repoRoot, "add", "frontend/app.tsx")
	app := newRepoBackedTestApp(t, repoRoot, "frontend")

	request := httptest.NewRequest(http.MethodPost, "/api/git/unstage-all", nil)
	recorder := httptest.NewRecorder()

	app.Handler().ServeHTTP(recorder, request)

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d: %s", recorder.Code, recorder.Body.String())
	}
	if !strings.Contains(recorder.Body.String(), "opening the repo root") {
		t.Fatalf("expected repo root message, got %q", recorder.Body.String())
	}
}

func TestHandleCommitReturnsConflictForScopedHiddenStagedFiles(t *testing.T) {
	t.Parallel()

	repoRoot := createServerActionRepo(t)
	writeServerTestFile(t, filepath.Join(repoRoot, "frontend", "app.tsx"), "export const app = 2\n")
	writeServerTestFile(t, filepath.Join(repoRoot, "root.txt"), "root staged\n")
	runServerGit(t, repoRoot, "add", "frontend/app.tsx", "root.txt")
	app := newRepoBackedTestApp(t, repoRoot, "frontend")

	request := httptest.NewRequest(http.MethodPost, "/api/git/commit", bytes.NewBufferString(`{"message":"scoped commit"}`))
	request.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()

	app.Handler().ServeHTTP(recorder, request)

	if recorder.Code != http.StatusConflict {
		t.Fatalf("expected status 409, got %d: %s", recorder.Code, recorder.Body.String())
	}
	if !strings.Contains(recorder.Body.String(), "outside the current workspace scope") {
		t.Fatalf("expected scoped conflict message, got %q", recorder.Body.String())
	}
}

func newRepoBackedTestApp(t *testing.T, repoRoot string, scopePath string) *App {
	t.Helper()

	app, err := newWithAssets(
		Config{
			Workspace: gitstatus.WorkspaceTarget{
				RepoRoot:  repoRoot,
				ScopePath: scopePath,
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

func createServerActionRepo(t *testing.T) string {
	t.Helper()

	repoRoot := t.TempDir()
	runServerGit(t, repoRoot, "init")
	runServerGit(t, repoRoot, "checkout", "-b", "main")
	runServerGit(t, repoRoot, "config", "user.email", "diffx@example.com")
	runServerGit(t, repoRoot, "config", "user.name", "Diffx Tests")
	if err := os.MkdirAll(filepath.Join(repoRoot, "frontend"), 0o755); err != nil {
		t.Fatalf("mkdir frontend: %v", err)
	}

	writeServerTestFile(t, filepath.Join(repoRoot, "frontend", "app.tsx"), "export const app = 1\n")
	writeServerTestFile(t, filepath.Join(repoRoot, "notes.txt"), "base\n")
	writeServerTestFile(t, filepath.Join(repoRoot, "root.txt"), "root\n")
	runServerGit(t, repoRoot, "add", ".")
	runServerGit(t, repoRoot, "commit", "-m", "initial commit")

	return repoRoot
}

func writeServerTestFile(t *testing.T, path string, contents string) {
	t.Helper()

	if err := os.WriteFile(path, []byte(contents), 0o644); err != nil {
		t.Fatalf("write %s: %v", path, err)
	}
}

func runServerGit(t *testing.T, dir string, args ...string) {
	t.Helper()

	cmd := exec.Command("git", args...)
	cmd.Dir = dir
	output, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("git %v failed: %v\n%s", args, err, string(output))
	}
}
