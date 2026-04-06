package server

import (
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

	if got, want := roots.worktreeRoot, repoRoot+"/frontend"; got != want {
		t.Fatalf("expected worktree root %q, got %q", want, got)
	}
	if got, want := roots.gitDir, repoRoot+"/.git"; got != want {
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

	writeServerTestFile(t, repoRoot+"/notes.txt", "base\nupdated\n")

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
