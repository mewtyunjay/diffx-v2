package server

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"

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

func TestHandleReviewFeedbackSubmitsDecision(t *testing.T) {
	t.Parallel()

	repoRoot := createServerActionRepo(t)
	app := newRepoBackedTestAppWithReview(t, repoRoot, ".", true)

	resultCh := make(chan ReviewFeedback, 1)
	errCh := make(chan error, 1)

	go func() {
		result, err := app.WaitForReviewFeedback(context.Background())
		if err != nil {
			errCh <- err
			return
		}
		resultCh <- result
	}()

	request := httptest.NewRequest(
		http.MethodPost,
		"/api/feedback",
		bytes.NewBufferString(`{"approved":false,"feedback":"Fix null handling","annotations":[{"path":"notes.txt","line":2}]}`),
	)
	request.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()

	app.Handler().ServeHTTP(recorder, request)

	if recorder.Code != http.StatusAccepted {
		t.Fatalf("expected status 202, got %d: %s", recorder.Code, recorder.Body.String())
	}

	select {
	case err := <-errCh:
		t.Fatalf("WaitForReviewFeedback returned error: %v", err)
	case result := <-resultCh:
		if result.Approved {
			t.Fatalf("expected approved false, got %#v", result)
		}
		if result.Feedback != "Fix null handling" {
			t.Fatalf("expected feedback to match, got %#v", result)
		}
		if len(result.Annotations) != 1 {
			t.Fatalf("expected one annotation, got %#v", result.Annotations)
		}
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for review feedback")
	}
}

func TestHandleReviewFeedbackReturnsNotFoundWhenDisabled(t *testing.T) {
	t.Parallel()

	repoRoot := createServerActionRepo(t)
	app := newRepoBackedTestAppWithReview(t, repoRoot, ".", false)

	request := httptest.NewRequest(
		http.MethodPost,
		"/api/feedback",
		bytes.NewBufferString(`{"approved":true,"feedback":"","annotations":[]}`),
	)
	request.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()

	app.Handler().ServeHTTP(recorder, request)

	if recorder.Code != http.StatusNotFound {
		t.Fatalf("expected status 404, got %d: %s", recorder.Code, recorder.Body.String())
	}
}

func TestHandleReviewStateReturnsDisabledWhenReviewModeOff(t *testing.T) {
	t.Parallel()

	repoRoot := createServerActionRepo(t)
	app := newRepoBackedTestAppWithReview(t, repoRoot, ".", false)

	request := httptest.NewRequest(http.MethodGet, "/api/review/state", nil)
	recorder := httptest.NewRecorder()

	app.Handler().ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", recorder.Code, recorder.Body.String())
	}

	var payload ReviewState
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode review state: %v", err)
	}

	if payload.Enabled {
		t.Fatalf("expected review mode disabled, got %#v", payload)
	}
	if payload.AcceptingFeedback {
		t.Fatalf("expected acceptingFeedback false, got %#v", payload)
	}
	if payload.Reason != "disabled" {
		t.Fatalf("expected reason disabled, got %#v", payload)
	}
}

func TestHandleReviewStateReflectsSubmittedFeedback(t *testing.T) {
	t.Parallel()

	repoRoot := createServerActionRepo(t)
	app := newRepoBackedTestAppWithReview(t, repoRoot, ".", true)

	submitRequest := httptest.NewRequest(
		http.MethodPost,
		"/api/feedback",
		bytes.NewBufferString(`{"approved":false,"feedback":"Follow up","annotations":[]}`),
	)
	submitRequest.Header.Set("Content-Type", "application/json")
	submitRecorder := httptest.NewRecorder()

	app.Handler().ServeHTTP(submitRecorder, submitRequest)
	if submitRecorder.Code != http.StatusAccepted {
		t.Fatalf("expected status 202, got %d: %s", submitRecorder.Code, submitRecorder.Body.String())
	}

	stateRequest := httptest.NewRequest(http.MethodGet, "/api/review/state", nil)
	stateRecorder := httptest.NewRecorder()

	app.Handler().ServeHTTP(stateRecorder, stateRequest)

	if stateRecorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", stateRecorder.Code, stateRecorder.Body.String())
	}

	var payload ReviewState
	if err := json.Unmarshal(stateRecorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode review state: %v", err)
	}

	if !payload.Enabled {
		t.Fatalf("expected review mode enabled, got %#v", payload)
	}
	if payload.AcceptingFeedback {
		t.Fatalf("expected acceptingFeedback false after submit, got %#v", payload)
	}
	if !payload.Submitted {
		t.Fatalf("expected submitted true, got %#v", payload)
	}
	if payload.Reason != "submitted" {
		t.Fatalf("expected reason submitted, got %#v", payload)
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

func TestHandleFilesDoesNotPublishRepoEvents(t *testing.T) {
	t.Parallel()

	repoRoot := createServerActionRepo(t)
	app := newRepoBackedTestApp(t, repoRoot, ".")
	events, unsubscribe := app.repoEvents.Subscribe()
	defer unsubscribe()

	request := httptest.NewRequest(http.MethodGet, "/api/files", nil)
	recorder := httptest.NewRecorder()

	app.Handler().ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", recorder.Code, recorder.Body.String())
	}

	assertNoRepoChangedEvent(t, events, 600*time.Millisecond)
}

func TestHandleFilesIncludesRepoName(t *testing.T) {
	t.Parallel()

	repoRoot := createServerActionRepo(t)
	app := newRepoBackedTestApp(t, repoRoot, ".")

	request := httptest.NewRequest(http.MethodGet, "/api/files", nil)
	recorder := httptest.NewRecorder()

	app.Handler().ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", recorder.Code, recorder.Body.String())
	}

	var payload struct {
		RepoName string `json:"repoName"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode files response: %v", err)
	}

	if payload.RepoName != filepath.Base(repoRoot) {
		t.Fatalf("expected repoName %q, got %q", filepath.Base(repoRoot), payload.RepoName)
	}
}

func TestHandleBranchesDoesNotPublishRepoEvents(t *testing.T) {
	t.Parallel()

	repoRoot := createServerActionRepo(t)
	app := newRepoBackedTestApp(t, repoRoot, ".")
	events, unsubscribe := app.repoEvents.Subscribe()
	defer unsubscribe()

	request := httptest.NewRequest(http.MethodGet, "/api/branches", nil)
	recorder := httptest.NewRecorder()

	app.Handler().ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", recorder.Code, recorder.Body.String())
	}

	assertNoRepoChangedEvent(t, events, 600*time.Millisecond)
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

func TestHandleConflictFileReturnsContent(t *testing.T) {
	t.Parallel()

	repoRoot := createServerActionRepo(t)
	writeServerTestFile(
		t,
		filepath.Join(repoRoot, "notes.txt"),
		"<<<<<<< HEAD\nours\n=======\ntheirs\n>>>>>>> branch\n",
	)
	app := newRepoBackedTestApp(t, repoRoot, ".")

	request := httptest.NewRequest(http.MethodGet, "/api/git/conflict-file?path=notes.txt", nil)
	recorder := httptest.NewRecorder()

	app.Handler().ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", recorder.Code, recorder.Body.String())
	}

	var payload gitstatus.ConflictFileResult
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode conflict file response: %v", err)
	}
	if !payload.Exists {
		t.Fatalf("expected conflict file to exist, got %#v", payload)
	}
	if !strings.Contains(payload.Contents, "<<<<<<< HEAD") {
		t.Fatalf("expected conflict markers, got %#v", payload)
	}
}

func TestHandleResolveConflictWritesFile(t *testing.T) {
	t.Parallel()

	repoRoot := createServerActionRepo(t)
	app := newRepoBackedTestApp(t, repoRoot, ".")

	request := httptest.NewRequest(
		http.MethodPost,
		"/api/git/conflict/resolve",
		bytes.NewBufferString(`{"path":"notes.txt","contents":"resolved\n"}`),
	)
	request.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()

	app.Handler().ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", recorder.Code, recorder.Body.String())
	}

	contents, err := os.ReadFile(filepath.Join(repoRoot, "notes.txt"))
	if err != nil {
		t.Fatalf("read notes.txt: %v", err)
	}
	if string(contents) != "resolved\n" {
		t.Fatalf("expected resolved content, got %q", string(contents))
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

func TestHandleCheckoutBranchSwitchesCurrentBranch(t *testing.T) {
	t.Parallel()

	repoRoot := createServerActionRepo(t)
	runServerGit(t, repoRoot, "checkout", "-b", "feature")
	runServerGit(t, repoRoot, "checkout", "main")
	app := newRepoBackedTestApp(t, repoRoot, ".")

	request := httptest.NewRequest(
		http.MethodPost,
		"/api/git/checkout",
		bytes.NewBufferString(`{"branch":"feature"}`),
	)
	request.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()

	app.Handler().ServeHTTP(recorder, request)

	if recorder.Code != http.StatusNoContent {
		t.Fatalf("expected status 204, got %d: %s", recorder.Code, recorder.Body.String())
	}

	current := strings.TrimSpace(runServerGitOutput(t, repoRoot, "branch", "--show-current"))
	if current != "feature" {
		t.Fatalf("expected current branch feature, got %q", current)
	}
}

func TestHandleCheckoutBranchRejectsWhenUncommittedChangesExist(t *testing.T) {
	t.Parallel()

	repoRoot := createServerActionRepo(t)
	runServerGit(t, repoRoot, "checkout", "-b", "feature")
	runServerGit(t, repoRoot, "checkout", "main")
	writeServerTestFile(t, filepath.Join(repoRoot, "notes.txt"), "base\nupdated\n")
	app := newRepoBackedTestApp(t, repoRoot, ".")

	request := httptest.NewRequest(
		http.MethodPost,
		"/api/git/checkout",
		bytes.NewBufferString(`{"branch":"feature"}`),
	)
	request.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()

	app.Handler().ServeHTTP(recorder, request)

	if recorder.Code != http.StatusConflict {
		t.Fatalf("expected status 409, got %d: %s", recorder.Code, recorder.Body.String())
	}
	if !strings.Contains(recorder.Body.String(), "unsaved changes") {
		t.Fatalf("expected unsaved changes error, got %q", recorder.Body.String())
	}
}

func newRepoBackedTestApp(t *testing.T, repoRoot string, scopePath string) *App {
	t.Helper()

	return newRepoBackedTestAppWithReview(t, repoRoot, scopePath, false)
}

func newRepoBackedTestAppWithReview(
	t *testing.T,
	repoRoot string,
	scopePath string,
	reviewEnabled bool,
) *App {
	t.Helper()

	app, err := newWithAssets(
		Config{
			Workspace: gitstatus.WorkspaceTarget{
				RepoRoot:  repoRoot,
				ScopePath: scopePath,
			},
			Review: ReviewConfig{
				Enabled: reviewEnabled,
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

func runServerGitOutput(t *testing.T, dir string, args ...string) string {
	t.Helper()

	cmd := exec.Command("git", args...)
	cmd.Dir = dir
	output, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("git %v failed: %v\n%s", args, err, string(output))
	}

	return string(output)
}
