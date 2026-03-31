package gitstatus

import (
	"bytes"
	"os"
	"os/exec"
	"path/filepath"
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

func runGit(t *testing.T, dir string, args ...string) {
	t.Helper()

	cmd := exec.Command("git", args...)
	cmd.Dir = dir
	if output, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("git %v failed: %v\n%s", args, err, string(output))
	}
}
