package gitstatus

import (
	"bytes"
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"slices"
	"strings"
	"testing"
)

func TestParsePorcelainStatus(t *testing.T) {
	output := []byte(" M frontend/src/App.tsx\x00?? frontend/src/app/changed-files/api.ts\x00R  frontend/src/new.tsx\x00frontend/src/old.tsx\x00")

	files, err := parsePorcelainStatus(output, t.TempDir())
	if err != nil {
		t.Fatalf("parsePorcelainStatus returned error: %v", err)
	}

	if len(files) != 3 {
		t.Fatalf("expected 3 files, got %d", len(files))
	}

	if files[0].Path != "frontend/src/App.tsx" || files[0].Status != StatusModified {
		t.Fatalf("unexpected first file: %#v", files[0])
	}

	if files[1].Path != "frontend/src/app/changed-files/api.ts" || files[1].Status != StatusAdded || files[1].IsTracked {
		t.Fatalf("unexpected second file: %#v", files[1])
	}

	if files[2].Path != "frontend/src/new.tsx" || files[2].Status != StatusRenamed || !files[2].HasStagedChanges {
		t.Fatalf("unexpected renamed file: %#v", files[2])
	}

	if files[2].PreviousPath != "frontend/src/old.tsx" {
		t.Fatalf("expected previous path to be captured, got %#v", files[2])
	}
}

func TestResolveRepoPathRejectsEscape(t *testing.T) {
	repoRoot := t.TempDir()

	if _, err := ResolveRepoPath(repoRoot, "../outside.txt"); err == nil {
		t.Fatal("expected path traversal to be rejected")
	}
}

func TestBuildCachedFileVersionMarksBinary(t *testing.T) {
	result := buildCachedFileVersion("image.png", []byte{0, 1, 2})

	if !result.binary {
		t.Fatal("expected binary content to be marked")
	}
	if result.version.Contents != "" {
		t.Fatalf("expected binary contents to stay empty, got %q", result.version.Contents)
	}
}

func TestBuildCachedFileVersionMarksLargeFiles(t *testing.T) {
	contents := bytes.Repeat([]byte("a"), maxDiffFileBytes+1)
	result := buildCachedFileVersion("large.ts", contents)

	if !result.tooLarge {
		t.Fatal("expected large content to be marked")
	}
	if result.version.Contents != "" {
		t.Fatalf("expected large contents to stay empty, got %q", result.version.Contents)
	}
}

func TestMatchesScope(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name      string
		path      string
		scopePath string
		want      bool
	}{
		{name: "repo root", path: "frontend/src/App.tsx", scopePath: ".", want: true},
		{name: "nested match", path: "frontend/src/App.tsx", scopePath: "frontend/src", want: true},
		{name: "exact match", path: "frontend/src", scopePath: "frontend/src", want: true},
		{name: "outside scope", path: "frontend/package.json", scopePath: "frontend/src", want: false},
		{name: "empty path", path: "", scopePath: ".", want: false},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			if got := matchesScope(tt.path, tt.scopePath); got != tt.want {
				t.Fatalf("matchesScope(%q, %q) = %v, want %v", tt.path, tt.scopePath, got, tt.want)
			}
		})
	}
}

func TestWorkspaceNameForScope(t *testing.T) {
	t.Parallel()

	repoRoot := filepath.Join(string(filepath.Separator), "tmp", "diffx-v2")

	if got := workspaceNameForScope(repoRoot, "."); got != "diffx-v2" {
		t.Fatalf("expected repo root name diffx-v2, got %q", got)
	}

	if got := workspaceNameForScope(repoRoot, "frontend/src"); got != "src" {
		t.Fatalf("expected nested workspace name src, got %q", got)
	}
}

func TestDisplayPathForScope(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name         string
		path         string
		previousPath string
		scopePath    string
		want         string
	}{
		{name: "repo root path stays unchanged", path: "frontend/src/App.tsx", scopePath: ".", want: "frontend/src/App.tsx"},
		{name: "nested scope trims prefix", path: "frontend/src/App.tsx", scopePath: "frontend/src", want: "App.tsx"},
		{name: "nested scope keeps subfolders", path: "frontend/src/app/api.ts", scopePath: "frontend/src", want: "app/api.ts"},
		{name: "rename out of scope uses previous path", path: "docs/App.tsx", previousPath: "frontend/src/App.tsx", scopePath: "frontend/src", want: "App.tsx"},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			if got := displayPathForScope(tt.path, tt.previousPath, tt.scopePath); got != tt.want {
				t.Fatalf("displayPathForScope(%q, %q, %q) = %q, want %q", tt.path, tt.previousPath, tt.scopePath, got, tt.want)
			}
		})
	}
}

func TestAllowsDiffUsesPreviousPath(t *testing.T) {
	t.Parallel()

	service := NewService("/tmp/repo", "frontend/src")
	if !service.AllowsDiff("docs/new-name.tsx", "frontend/src/old-name.tsx") {
		t.Fatal("expected rename crossing scope boundary to be allowed")
	}
}

func TestResolveWorkspaceTarget(t *testing.T) {
	t.Parallel()

	repoRoot := t.TempDir()
	runGit(t, repoRoot, "init")

	nestedDir := filepath.Join(repoRoot, "frontend", "src")
	if err := os.MkdirAll(nestedDir, 0o755); err != nil {
		t.Fatalf("create nested dir: %v", err)
	}

	target, err := ResolveWorkspaceTarget(nestedDir)
	if err != nil {
		t.Fatalf("ResolveWorkspaceTarget returned error: %v", err)
	}

	resolvedRepoRoot, err := filepath.EvalSymlinks(repoRoot)
	if err != nil {
		t.Fatalf("EvalSymlinks(repoRoot): %v", err)
	}

	if target.RepoRoot != resolvedRepoRoot {
		t.Fatalf("expected repo root %q, got %q", resolvedRepoRoot, target.RepoRoot)
	}
	if target.ScopePath != "frontend/src" {
		t.Fatalf("expected scope path frontend/src, got %q", target.ScopePath)
	}
}

func TestResolveWorkspaceTargetRejectsNonGitDirectories(t *testing.T) {
	t.Parallel()

	_, err := ResolveWorkspaceTarget(t.TempDir())
	if err == nil {
		t.Fatal("expected non-git directory to be rejected")
	}
	if !strings.Contains(err.Error(), ErrNotGitRepo.Error()) {
		t.Fatalf("expected not-git error, got %v", err)
	}
}

func TestListBranchesDedupesMatchingRemote(t *testing.T) {
	t.Parallel()

	repoRoot := createComparisonRepo(t)
	runGit(t, repoRoot, "update-ref", "refs/remotes/origin/main", "main")
	runGit(t, repoRoot, "symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/main")

	service := NewService(repoRoot, ".")
	result, err := service.ListBranches(context.Background())
	if err != nil {
		t.Fatalf("ListBranches returned error: %v", err)
	}

	if result.CurrentRef != "feature" {
		t.Fatalf("expected current ref feature, got %q", result.CurrentRef)
	}

	if len(result.Branches) != 2 {
		t.Fatalf("expected 2 branches, got %#v", result.Branches)
	}

	names := []string{result.Branches[0].Name, result.Branches[1].Name}
	if !slices.Equal(names, []string{"feature", "main"}) {
		t.Fatalf("unexpected branch order: %#v", names)
	}

	for _, branch := range result.Branches {
		if branch.Name == "origin/main" || branch.Name == "origin/HEAD" {
			t.Fatalf("expected remote duplicates to be filtered, got %#v", result.Branches)
		}
	}
}

func TestListChangedFilesAgainstBaseIncludesBranchAndUntrackedChanges(t *testing.T) {
	t.Parallel()

	repoRoot := createComparisonRepo(t)
	service := NewService(repoRoot, ".")

	result, err := service.ListChangedFiles(context.Background(), "main")
	if err != nil {
		t.Fatalf("ListChangedFiles returned error: %v", err)
	}

	if result.Mode != ComparisonModeBranch {
		t.Fatalf("expected branch mode, got %q", result.Mode)
	}
	if result.BaseRef != "main" {
		t.Fatalf("expected base ref main, got %q", result.BaseRef)
	}
	if result.CurrentRef != "feature" {
		t.Fatalf("expected current ref feature, got %q", result.CurrentRef)
	}
	if len(result.Files) != 5 {
		t.Fatalf("expected 5 files, got %#v", result.Files)
	}

	filesByPath := make(map[string]ChangedFileItem, len(result.Files))
	for _, file := range result.Files {
		filesByPath[file.Path] = file
	}

	if file := filesByPath["alpha.txt"]; file.Status != StatusModified || !file.HasUnstagedChanges {
		t.Fatalf("expected alpha.txt to be modified with unstaged changes, got %#v", file)
	}
	if file := filesByPath["tracked.txt"]; file.Status != StatusAdded || !file.IsTracked {
		t.Fatalf("expected tracked.txt to be a tracked add, got %#v", file)
	}
	if file := filesByPath["scratch.txt"]; file.Status != StatusAdded || file.IsTracked || !file.HasUnstagedChanges {
		t.Fatalf("expected scratch.txt to be an untracked add, got %#v", file)
	}
	if file := filesByPath["keep.txt"]; file.Status != StatusDeleted {
		t.Fatalf("expected keep.txt to be deleted, got %#v", file)
	}
	if file := filesByPath["new.txt"]; file.Status != StatusRenamed || file.PreviousPath != "old.txt" {
		t.Fatalf("expected new.txt to be a rename from old.txt, got %#v", file)
	}
}

func TestReadFileDiffUsesSelectedBaseRef(t *testing.T) {
	t.Parallel()

	repoRoot := createComparisonRepo(t)
	service := NewService(repoRoot, ".")

	diff, err := service.ReadFileDiff(context.Background(), "alpha.txt", StatusModified, "", "main")
	if err != nil {
		t.Fatalf("ReadFileDiff returned error: %v", err)
	}

	if diff.Mode != ComparisonModeBranch {
		t.Fatalf("expected branch mode, got %q", diff.Mode)
	}
	if diff.BaseRef != "main" {
		t.Fatalf("expected base ref main, got %q", diff.BaseRef)
	}
	if !strings.Contains(diff.Before.Contents, "alpha base") {
		t.Fatalf("expected before contents from main, got %q", diff.Before.Contents)
	}
	if !strings.Contains(diff.After.Contents, "alpha worktree") {
		t.Fatalf("expected after contents from worktree, got %q", diff.After.Contents)
	}
}

func TestListChangedFilesIncludesInitialDiffForFirstVisibleFile(t *testing.T) {
	t.Parallel()

	repoRoot := createComparisonRepo(t)
	service := NewService(repoRoot, ".")

	result, err := service.ListChangedFiles(context.Background(), "HEAD")
	if err != nil {
		t.Fatalf("ListChangedFiles returned error: %v", err)
	}

	if len(result.Files) == 0 {
		t.Fatal("expected changed files")
	}
	if result.InitialDiff == nil {
		t.Fatal("expected initial diff to be populated")
	}
	if result.InitialDiff.Path != result.Files[0].Path {
		t.Fatalf("expected initial diff for %q, got %q", result.Files[0].Path, result.InitialDiff.Path)
	}
	if result.InitialDiff.Status != result.Files[0].Status {
		t.Fatalf("expected initial diff status %q, got %q", result.Files[0].Status, result.InitialDiff.Status)
	}
}

func createComparisonRepo(t *testing.T) string {
	t.Helper()

	repoRoot := t.TempDir()
	runGit(t, repoRoot, "init")
	runGit(t, repoRoot, "checkout", "-b", "main")
	runGit(t, repoRoot, "config", "user.email", "diffx@example.com")
	runGit(t, repoRoot, "config", "user.name", "Diffx Tests")

	writeFile(t, filepath.Join(repoRoot, "alpha.txt"), "alpha base\n")
	writeFile(t, filepath.Join(repoRoot, "old.txt"), "rename me\n")
	writeFile(t, filepath.Join(repoRoot, "keep.txt"), "delete me\n")
	runGit(t, repoRoot, "add", ".")
	runGit(t, repoRoot, "commit", "-m", "base commit")

	runGit(t, repoRoot, "checkout", "-b", "feature")

	writeFile(t, filepath.Join(repoRoot, "alpha.txt"), "alpha branch\n")
	runGit(t, repoRoot, "mv", "old.txt", "new.txt")
	if err := os.Remove(filepath.Join(repoRoot, "keep.txt")); err != nil {
		t.Fatalf("remove keep.txt: %v", err)
	}
	writeFile(t, filepath.Join(repoRoot, "tracked.txt"), "tracked branch file\n")
	runGit(t, repoRoot, "add", ".")
	runGit(t, repoRoot, "commit", "-m", "feature commit")

	writeFile(t, filepath.Join(repoRoot, "alpha.txt"), "alpha worktree\n")
	writeFile(t, filepath.Join(repoRoot, "scratch.txt"), "untracked file\n")

	return repoRoot
}

func writeFile(t *testing.T, path string, contents string) {
	t.Helper()

	if err := os.WriteFile(path, []byte(contents), 0o644); err != nil {
		t.Fatalf("write %s: %v", path, err)
	}
}

func runGit(t *testing.T, dir string, args ...string) {
	t.Helper()

	cmd := exec.Command("git", args...)
	cmd.Dir = dir
	if output, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("git %v failed: %v\n%s", args, err, string(output))
	}
}
