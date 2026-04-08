package server

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"diffx/internal/gitstatus"
)

func TestRepoWatcherIgnoresGitIgnoredFilesCreatedAfterStartup(t *testing.T) {
	t.Parallel()

	repoRoot := createServerActionRepo(t)
	writeServerTestFile(t, filepath.Join(repoRoot, ".gitignore"), "*.log\n")

	hub := newRepoEventHub()
	watcher, err := newRepoWatcher(gitstatus.WorkspaceTarget{
		RepoRoot:  repoRoot,
		ScopePath: ".",
	}, hub)
	if err != nil {
		t.Fatalf("newRepoWatcher returned error: %v", err)
	}
	defer watcher.Close()
	defer hub.Close()

	events, unsubscribe := hub.Subscribe()
	defer unsubscribe()

	writeServerTestFile(t, filepath.Join(repoRoot, "ignored.log"), "ignore me\n")
	assertNoRepoChangedEvent(t, events, 600*time.Millisecond)
}

func TestRepoWatcherDoesNotAddWatchesForGitIgnoredDirectoriesCreatedAfterStartup(t *testing.T) {
	t.Parallel()

	repoRoot := createServerActionRepo(t)
	writeServerTestFile(t, filepath.Join(repoRoot, ".gitignore"), "generated/\n")

	hub := newRepoEventHub()
	watcher, err := newRepoWatcher(gitstatus.WorkspaceTarget{
		RepoRoot:  repoRoot,
		ScopePath: ".",
	}, hub)
	if err != nil {
		t.Fatalf("newRepoWatcher returned error: %v", err)
	}
	defer watcher.Close()
	defer hub.Close()

	events, unsubscribe := hub.Subscribe()
	defer unsubscribe()

	generatedDir := filepath.Join(repoRoot, "generated")
	if err := os.MkdirAll(generatedDir, 0o755); err != nil {
		t.Fatalf("mkdir generated: %v", err)
	}
	writeServerTestFile(t, filepath.Join(generatedDir, "bundle.js"), "console.log('ignored')\n")

	assertNoRepoChangedEvent(t, events, 600*time.Millisecond)
	if _, ok := watcher.watched[generatedDir]; ok {
		t.Fatalf("expected %q to be skipped", generatedDir)
	}
}
