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

	if got, want := roots.worktreeRoot, filepath.Join(repoRoot, "frontend"); got != want {
		t.Fatalf("expected worktree root %q, got %q", want, got)
	}
	if got, want := roots.gitDir, filepath.Join(repoRoot, ".git"); got != want {
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
