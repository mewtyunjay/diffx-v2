package gitstatus

import (
	"context"
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

func TestParseAheadBehindCounts(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name        string
		output      string
		wantAhead   int
		wantBehind  int
		expectError bool
	}{
		{name: "tab separated", output: "2\t3\n", wantAhead: 2, wantBehind: 3},
		{name: "space separated", output: "4 1", wantAhead: 4, wantBehind: 1},
		{name: "invalid format", output: "4", expectError: true},
		{name: "invalid number", output: "x 1", expectError: true},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			aheadCount, behindCount, err := parseAheadBehindCounts(tt.output)
			if tt.expectError {
				if err == nil {
					t.Fatalf("expected error for output %q", tt.output)
				}
				return
			}

			if err != nil {
				t.Fatalf("unexpected error for output %q: %v", tt.output, err)
			}
			if aheadCount != tt.wantAhead || behindCount != tt.wantBehind {
				t.Fatalf(
					"parseAheadBehindCounts(%q) = (%d, %d), want (%d, %d)",
					tt.output,
					aheadCount,
					behindCount,
					tt.wantAhead,
					tt.wantBehind,
				)
			}
		})
	}
}

func TestStageAndUnstageFile(t *testing.T) {
	t.Parallel()

	repoRoot := createActionRepo(t)
	service := NewService(repoRoot, ".")

	writeFile(t, filepath.Join(repoRoot, "notes.txt"), "base\nupdated\n")

	if err := service.StageFile(context.Background(), "notes.txt", ""); err != nil {
		t.Fatalf("StageFile returned error: %v", err)
	}

	result, err := service.ListChangedFiles(context.Background(), "HEAD")
	if err != nil {
		t.Fatalf("ListChangedFiles returned error: %v", err)
	}

	if len(result.Files) != 1 || !result.Files[0].HasStagedChanges || result.Files[0].HasUnstagedChanges {
		t.Fatalf("expected fully staged file, got %#v", result.Files)
	}

	if err := service.UnstageFile(context.Background(), "notes.txt", ""); err != nil {
		t.Fatalf("UnstageFile returned error: %v", err)
	}

	result, err = service.ListChangedFiles(context.Background(), "HEAD")
	if err != nil {
		t.Fatalf("ListChangedFiles returned error: %v", err)
	}

	if len(result.Files) != 1 || result.Files[0].HasStagedChanges || !result.Files[0].HasUnstagedChanges {
		t.Fatalf("expected fully unstaged file, got %#v", result.Files)
	}
}

func TestStageAndUnstageAllAtRepoRoot(t *testing.T) {
	t.Parallel()

	repoRoot := createActionRepo(t)
	service := NewService(repoRoot, ".")

	writeFile(t, filepath.Join(repoRoot, "notes.txt"), "base\nupdated\n")
	writeFile(t, filepath.Join(repoRoot, "fresh.txt"), "fresh\n")
	if err := os.Remove(filepath.Join(repoRoot, "root.txt")); err != nil {
		t.Fatalf("remove root.txt: %v", err)
	}

	if err := service.StageAll(context.Background()); err != nil {
		t.Fatalf("StageAll returned error: %v", err)
	}

	result, err := service.ListChangedFiles(context.Background(), "HEAD")
	if err != nil {
		t.Fatalf("ListChangedFiles returned error: %v", err)
	}

	if len(result.Files) != 3 {
		t.Fatalf("expected 3 changed files after StageAll, got %#v", result.Files)
	}
	for _, file := range result.Files {
		if !file.HasStagedChanges || file.HasUnstagedChanges {
			t.Fatalf("expected fully staged files after StageAll, got %#v", result.Files)
		}
	}

	if err := service.UnstageAll(context.Background()); err != nil {
		t.Fatalf("UnstageAll returned error: %v", err)
	}

	result, err = service.ListChangedFiles(context.Background(), "HEAD")
	if err != nil {
		t.Fatalf("ListChangedFiles returned error: %v", err)
	}

	if len(result.Files) != 3 {
		t.Fatalf("expected 3 changed files after UnstageAll, got %#v", result.Files)
	}
	for _, file := range result.Files {
		if file.HasStagedChanges || !file.HasUnstagedChanges {
			t.Fatalf("expected fully unstaged files after UnstageAll, got %#v", result.Files)
		}
	}
}

func TestBulkStageActionsRequireRepoRootScope(t *testing.T) {
	t.Parallel()

	repoRoot := createActionRepo(t)
	service := NewService(repoRoot, "frontend")

	if err := service.StageAll(context.Background()); !errors.Is(err, ErrBulkActionNotAtRoot) {
		t.Fatalf("expected ErrBulkActionNotAtRoot from StageAll, got %v", err)
	}

	if err := service.UnstageAll(context.Background()); !errors.Is(err, ErrBulkActionNotAtRoot) {
		t.Fatalf("expected ErrBulkActionNotAtRoot from UnstageAll, got %v", err)
	}
}

func TestStageFileAllowsTrackedMoveIntoIgnoredPath(t *testing.T) {
	t.Parallel()

	repoRoot := createActionRepo(t)
	service := NewService(repoRoot, ".")

	if err := os.MkdirAll(filepath.Join(repoRoot, "cmd", "diffx"), 0o755); err != nil {
		t.Fatalf("mkdir cmd/diffx: %v", err)
	}
	writeFile(t, filepath.Join(repoRoot, ".gitignore"), "cmd/diffx/*.go\n")
	if err := os.Rename(
		filepath.Join(repoRoot, "notes.txt"),
		filepath.Join(repoRoot, "cmd", "diffx", "main.go"),
	); err != nil {
		t.Fatalf("rename notes.txt: %v", err)
	}

	if err := service.StageFile(context.Background(), "cmd/diffx/main.go", "notes.txt"); err != nil {
		t.Fatalf("StageFile returned error: %v", err)
	}

	status := runGitOutput(t, repoRoot, "status", "--porcelain=v1")
	if !strings.Contains(status, "D  notes.txt") {
		t.Fatalf("expected tracked deletion to be staged, got %q", status)
	}
	if strings.Contains(status, "cmd/diffx/main.go") {
		t.Fatalf("expected ignored destination to stay out of git status, got %q", status)
	}
}

func TestListChangedFilesTracksHiddenStagedFilesOutsideScope(t *testing.T) {
	t.Parallel()

	repoRoot := createActionRepo(t)
	writeFile(t, filepath.Join(repoRoot, "frontend", "app.tsx"), "export const app = 2\n")
	writeFile(t, filepath.Join(repoRoot, "root.txt"), "root staged\n")
	runGit(t, repoRoot, "add", "frontend/app.tsx", "root.txt")

	service := NewService(repoRoot, "frontend")
	result, err := service.ListChangedFiles(context.Background(), "HEAD")
	if err != nil {
		t.Fatalf("ListChangedFiles returned error: %v", err)
	}

	if result.HiddenStagedFileCount != 1 {
		t.Fatalf("expected 1 hidden staged file, got %d", result.HiddenStagedFileCount)
	}
	if len(result.Files) != 1 || result.Files[0].Path != "frontend/app.tsx" || !result.Files[0].HasStagedChanges {
		t.Fatalf("expected only frontend/app.tsx to be visible and staged, got %#v", result.Files)
	}
}

func TestCommitStagedRejectsHiddenScopedChanges(t *testing.T) {
	t.Parallel()

	repoRoot := createActionRepo(t)
	writeFile(t, filepath.Join(repoRoot, "frontend", "app.tsx"), "export const app = 2\n")
	writeFile(t, filepath.Join(repoRoot, "root.txt"), "root staged\n")
	runGit(t, repoRoot, "add", "frontend/app.tsx", "root.txt")

	service := NewService(repoRoot, "frontend")
	_, err := service.CommitStaged(context.Background(), "scoped commit")
	if err == nil {
		t.Fatal("expected scoped commit to be rejected")
	}

	var scopedErr *ScopedCommitBlockedError
	if !errors.As(err, &scopedErr) {
		t.Fatalf("expected ScopedCommitBlockedError, got %v", err)
	}
	if scopedErr.HiddenStagedFileCount != 1 {
		t.Fatalf("expected hidden staged count 1, got %d", scopedErr.HiddenStagedFileCount)
	}
}

func TestCommitStagedCreatesCommit(t *testing.T) {
	t.Parallel()

	repoRoot := createActionRepo(t)
	service := NewService(repoRoot, ".")

	writeFile(t, filepath.Join(repoRoot, "notes.txt"), "base\nupdated\n")
	runGit(t, repoRoot, "add", "notes.txt")

	commitSHA, err := service.CommitStaged(context.Background(), "update notes\n\nwith body")
	if err != nil {
		t.Fatalf("CommitStaged returned error: %v", err)
	}
	if commitSHA == "" {
		t.Fatal("expected commit SHA")
	}

	message := strings.TrimSpace(runGitOutput(t, repoRoot, "log", "-1", "--pretty=%B"))
	if message != "update notes\n\nwith body" {
		t.Fatalf("unexpected commit message: %q", message)
	}
}

func TestPushCurrentBranchFallsBackToOriginWhenUpstreamIsMissing(t *testing.T) {
	t.Parallel()

	repoRoot := createActionRepo(t)
	remoteRoot := filepath.Join(t.TempDir(), "remote.git")
	runGit(t, filepath.Dir(remoteRoot), "init", "--bare", remoteRoot)
	runGit(t, repoRoot, "remote", "add", "origin", remoteRoot)

	service := NewService(repoRoot, ".")
	writeFile(t, filepath.Join(repoRoot, "notes.txt"), "base\nupdated\n")
	runGit(t, repoRoot, "add", "notes.txt")
	if _, err := service.CommitStaged(context.Background(), "push me"); err != nil {
		t.Fatalf("CommitStaged returned error: %v", err)
	}

	pushResult, err := service.PushCurrentBranch(context.Background())
	if err != nil {
		t.Fatalf("PushCurrentBranch returned error: %v", err)
	}
	if pushResult.RemoteRef != "origin/main" {
		t.Fatalf("expected remote ref origin/main, got %q", pushResult.RemoteRef)
	}
	if !pushResult.CreatedUpstream {
		t.Fatalf("expected CreatedUpstream true, got %#v", pushResult)
	}

	upstream := strings.TrimSpace(runGitOutput(t, repoRoot, "rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"))
	if upstream != "origin/main" {
		t.Fatalf("expected upstream origin/main, got %q", upstream)
	}
}

func TestPushCurrentBranchWithExistingUpstreamDoesNotCreateUpstream(t *testing.T) {
	t.Parallel()

	repoRoot := createActionRepo(t)
	remoteRoot := filepath.Join(t.TempDir(), "remote.git")
	runGit(t, filepath.Dir(remoteRoot), "init", "--bare", remoteRoot)
	runGit(t, repoRoot, "remote", "add", "origin", remoteRoot)
	runGit(t, repoRoot, "push", "-u", "origin", "main")

	service := NewService(repoRoot, ".")
	writeFile(t, filepath.Join(repoRoot, "notes.txt"), "base\nupdated\n")
	runGit(t, repoRoot, "add", "notes.txt")
	if _, err := service.CommitStaged(context.Background(), "push me"); err != nil {
		t.Fatalf("CommitStaged returned error: %v", err)
	}

	pushResult, err := service.PushCurrentBranch(context.Background())
	if err != nil {
		t.Fatalf("PushCurrentBranch returned error: %v", err)
	}
	if pushResult.RemoteRef != "origin/main" {
		t.Fatalf("expected remote ref origin/main, got %q", pushResult.RemoteRef)
	}
	if pushResult.CreatedUpstream {
		t.Fatalf("expected CreatedUpstream false, got %#v", pushResult)
	}
}

func TestCheckoutBranchSwitchesToExistingLocalBranch(t *testing.T) {
	t.Parallel()

	repoRoot := createActionRepo(t)
	runGit(t, repoRoot, "checkout", "-b", "feature")
	runGit(t, repoRoot, "checkout", "main")
	service := NewService(repoRoot, ".")

	if err := service.CheckoutBranch(context.Background(), "feature"); err != nil {
		t.Fatalf("CheckoutBranch returned error: %v", err)
	}

	current := strings.TrimSpace(runGitOutput(t, repoRoot, "branch", "--show-current"))
	if current != "feature" {
		t.Fatalf("expected current branch feature, got %q", current)
	}
}

func TestCheckoutBranchRejectsWhenUncommittedChangesExist(t *testing.T) {
	t.Parallel()

	repoRoot := createActionRepo(t)
	runGit(t, repoRoot, "checkout", "-b", "feature")
	runGit(t, repoRoot, "checkout", "main")
	writeFile(t, filepath.Join(repoRoot, "notes.txt"), "base\nupdated\n")
	service := NewService(repoRoot, ".")

	err := service.CheckoutBranch(context.Background(), "feature")
	if !errors.Is(err, ErrUncommittedChanges) {
		t.Fatalf("expected ErrUncommittedChanges, got %v", err)
	}
}

func TestBranchSyncStatusWithoutUpstream(t *testing.T) {
	t.Parallel()

	repoRoot := createActionRepo(t)
	service := NewService(repoRoot, ".")

	syncStatus, err := service.BranchSyncStatus(context.Background())
	if err != nil {
		t.Fatalf("BranchSyncStatus returned error: %v", err)
	}
	if syncStatus.HasUpstream {
		t.Fatalf("expected no upstream, got %#v", syncStatus)
	}
	if syncStatus.UpstreamRef != "" {
		t.Fatalf("expected empty upstream ref, got %#v", syncStatus)
	}
	if syncStatus.AheadCount != 0 || syncStatus.BehindCount != 0 {
		t.Fatalf("expected ahead=0 behind=0, got %#v", syncStatus)
	}
}

func TestBranchSyncStatusTracksAheadAndBehindCounts(t *testing.T) {
	t.Parallel()

	repoRoot := createActionRepo(t)
	remoteRoot := filepath.Join(t.TempDir(), "remote.git")
	runGit(t, filepath.Dir(remoteRoot), "init", "--bare", remoteRoot)
	runGit(t, repoRoot, "remote", "add", "origin", remoteRoot)
	runGit(t, repoRoot, "push", "-u", "origin", "main")

	service := NewService(repoRoot, ".")
	writeFile(t, filepath.Join(repoRoot, "notes.txt"), "base\nupdated locally\n")
	runGit(t, repoRoot, "add", "notes.txt")
	if _, err := service.CommitStaged(context.Background(), "local ahead"); err != nil {
		t.Fatalf("CommitStaged returned error: %v", err)
	}

	syncStatus, err := service.BranchSyncStatus(context.Background())
	if err != nil {
		t.Fatalf("BranchSyncStatus returned error: %v", err)
	}
	if !syncStatus.HasUpstream {
		t.Fatalf("expected upstream to exist, got %#v", syncStatus)
	}
	if syncStatus.UpstreamRef != "origin/main" {
		t.Fatalf("expected origin/main upstream, got %#v", syncStatus)
	}
	if syncStatus.AheadCount != 1 || syncStatus.BehindCount != 0 {
		t.Fatalf("expected ahead=1 behind=0, got %#v", syncStatus)
	}
}

func TestBranchSyncStatusWithoutUpstreamCanReportNoLocalCommits(t *testing.T) {
	t.Parallel()

	repoRoot := createActionRepo(t)
	remoteRoot := filepath.Join(t.TempDir(), "remote.git")
	runGit(t, filepath.Dir(remoteRoot), "init", "--bare", remoteRoot)
	runGit(t, repoRoot, "remote", "add", "origin", remoteRoot)
	runGit(t, repoRoot, "push", "-u", "origin", "main")
	runGit(t, repoRoot, "checkout", "-b", "feature")

	service := NewService(repoRoot, ".")
	syncStatus, err := service.BranchSyncStatus(context.Background())
	if err != nil {
		t.Fatalf("BranchSyncStatus returned error: %v", err)
	}
	if syncStatus.HasUpstream {
		t.Fatalf("expected no upstream for feature, got %#v", syncStatus)
	}
	if syncStatus.AheadCount != 0 || syncStatus.BehindCount != 0 {
		t.Fatalf("expected ahead=0 behind=0, got %#v", syncStatus)
	}
}

func createActionRepo(t *testing.T) string {
	t.Helper()

	repoRoot := t.TempDir()
	runGit(t, repoRoot, "init")
	runGit(t, repoRoot, "checkout", "-b", "main")
	runGit(t, repoRoot, "config", "user.email", "diffx@example.com")
	runGit(t, repoRoot, "config", "user.name", "Diffx Tests")
	if err := os.MkdirAll(filepath.Join(repoRoot, "frontend"), 0o755); err != nil {
		t.Fatalf("mkdir frontend: %v", err)
	}

	writeFile(t, filepath.Join(repoRoot, "frontend", "app.tsx"), "export const app = 1\n")
	writeFile(t, filepath.Join(repoRoot, "notes.txt"), "base\n")
	writeFile(t, filepath.Join(repoRoot, "root.txt"), "root\n")
	runGit(t, repoRoot, "add", ".")
	runGit(t, repoRoot, "commit", "-m", "initial commit")

	return repoRoot
}

func runGitOutput(t *testing.T, dir string, args ...string) string {
	t.Helper()

	cmd := exec.Command("git", args...)
	cmd.Dir = dir
	output, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("git %v failed: %v\n%s", args, err, string(output))
	}

	return string(output)
}
