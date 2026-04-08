package server

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"diffx/internal/gitstatus"
)

func TestResolveRepoWatchRootsUsesScopeAndGitDir(t *testing.T) {
	t.Parallel()

	repoRoot := createServerActionRepo(t)

	roots, err := resolveRepoWatchRoots(gitstatus.WorkspaceTarget{
		RepoRoot:  repoRoot,
		ScopePath: "frontend",
	})
	if err != nil {
		t.Fatalf("resolveRepoWatchRoots returned error: %v", err)
	}

	wantWorktreeRoot, err := resolveExistingDirectory(filepath.Join(repoRoot, "frontend"))
	if err != nil {
		t.Fatalf("resolve expected worktree root: %v", err)
	}
	if got, want := roots.worktreeRoot, wantWorktreeRoot; got != want {
		t.Fatalf("expected worktree root %q, got %q", want, got)
	}
	wantGitDir, err := resolveExistingDirectory(filepath.Join(repoRoot, ".git"))
	if err != nil {
		t.Fatalf("resolve expected git dir: %v", err)
	}
	if got, want := roots.gitDir, wantGitDir; got != want {
		t.Fatalf("expected git dir %q, got %q", want, got)
	}
}

func TestRepoWatcherPublishesWorktreeEvents(t *testing.T) {
	t.Parallel()

	repoRoot := createServerActionRepo(t)
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

	writeServerTestFile(t, filepath.Join(repoRoot, "notes.txt"), "base\nupdated\n")

	event := waitForRepoChangedEvent(t, events)
	if event.Kind != repoChangeWorktree {
		t.Fatalf("expected worktree event, got %q", event.Kind)
	}
}

func TestRepoWatcherPublishesGitEvents(t *testing.T) {
	t.Parallel()

	repoRoot := createServerActionRepo(t)
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

	runServerGit(t, repoRoot, "branch", "watcher-test")

	event := waitForRepoChangedEvent(t, events)
	if event.Kind != repoChangeGit {
		t.Fatalf("expected git event, got %q", event.Kind)
	}
}

func TestRepoWatcherIgnoresIndexLockChanges(t *testing.T) {
	t.Parallel()

	repoRoot := createServerActionRepo(t)
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

	lockPath := filepath.Join(repoRoot, ".git", "index.lock")
	writeServerTestFile(t, lockPath, "")
	assertNoRepoChangedEvent(t, events, 600*time.Millisecond)

	if err := os.Remove(lockPath); err != nil {
		t.Fatalf("remove %s: %v", lockPath, err)
	}
	assertNoRepoChangedEvent(t, events, 600*time.Millisecond)
}

func TestRepoWatcherIgnoresOtherGitLockChanges(t *testing.T) {
	t.Parallel()

	repoRoot := createServerActionRepo(t)
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

	lockPath := filepath.Join(repoRoot, ".git", "refs", "heads", "watcher-test.lock")
	writeServerTestFile(t, lockPath, "lock\n")
	assertNoRepoChangedEvent(t, events, 600*time.Millisecond)

	if err := os.Remove(lockPath); err != nil {
		t.Fatalf("remove %s: %v", lockPath, err)
	}
	assertNoRepoChangedEvent(t, events, 600*time.Millisecond)
}

func TestRepoWatcherSkipsGitIgnoredTree(t *testing.T) {
	t.Parallel()

	repoRoot := createServerActionRepo(t)
	nodeModulesBinDir := filepath.Join(repoRoot, "frontend", "node_modules", ".bin")
	if err := os.MkdirAll(nodeModulesBinDir, 0o755); err != nil {
		t.Fatalf("mkdir node_modules/.bin: %v", err)
	}
	writeServerTestFile(t, filepath.Join(repoRoot, ".gitignore"), "frontend/node_modules/\n")
	if err := os.Symlink("jiti 2", filepath.Join(nodeModulesBinDir, "jiti")); err != nil {
		t.Fatalf("symlink broken bin entry: %v", err)
	}

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

	nodeModulesDir := filepath.Join(repoRoot, "frontend", "node_modules")
	if _, ok := watcher.watched[nodeModulesDir]; ok {
		t.Fatalf("expected %q to be skipped", nodeModulesDir)
	}
	if _, ok := watcher.watched[nodeModulesBinDir]; ok {
		t.Fatalf("expected %q to be skipped", nodeModulesBinDir)
	}
}

func waitForRepoChangedEvent(t *testing.T, events <-chan repoChangedEvent) repoChangedEvent {
	t.Helper()

	select {
	case event := <-events:
		return event
	case <-time.After(5 * time.Second):
		t.Fatal("timed out waiting for repo event")
		return repoChangedEvent{}
	}
}

func assertNoRepoChangedEvent(t *testing.T, events <-chan repoChangedEvent, wait time.Duration) {
	t.Helper()

	timer := time.NewTimer(wait)
	defer timer.Stop()

	select {
	case event := <-events:
		t.Fatalf("expected no repo event, got %q", event.Kind)
	case <-timer.C:
	}
}
