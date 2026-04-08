package server

import (
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"diffx/internal/gitstatus"

	"github.com/fsnotify/fsnotify"
)

const repoWatchDebounce = 200 * time.Millisecond

type repoWatchRoots struct {
	worktreeRoot string
	gitDir       string
}

type repoWatcher struct {
	watcher      *fsnotify.Watcher
	repoEvents   *repoEventHub
	debounce     time.Duration
	worktreeRoot string
	gitDir       string
	ignoredPaths *repoIgnoreMatcher
	watched      map[string]repoChangeKind
	suppressMu   sync.Mutex
	suppressGit  int
	done         chan struct{}
	closeOnce    sync.Once
}

func newRepoWatcher(workspace gitstatus.WorkspaceTarget, repoEvents *repoEventHub) (*repoWatcher, error) {
	roots, err := resolveRepoWatchRoots(workspace)
	if err != nil {
		return nil, err
	}

	ignoredPaths, err := newRepoIgnoreMatcher(workspace.RepoRoot, roots.worktreeRoot)
	if err != nil {
		return nil, err
	}

	fswatcher, err := fsnotify.NewWatcher()
	if err != nil {
		return nil, fmt.Errorf("create fsnotify watcher: %w", err)
	}

	watcher := &repoWatcher{
		watcher:      fswatcher,
		repoEvents:   repoEvents,
		debounce:     repoWatchDebounce,
		worktreeRoot: roots.worktreeRoot,
		gitDir:       roots.gitDir,
		ignoredPaths: ignoredPaths,
		watched:      make(map[string]repoChangeKind),
		done:         make(chan struct{}),
	}

	if err := watcher.addInitialWatches(); err != nil {
		_ = fswatcher.Close()
		return nil, err
	}

	go watcher.run()

	return watcher, nil
}

func (w *repoWatcher) addInitialWatches() error {
	if err := w.addTree(w.worktreeRoot, repoChangeWorktree); err != nil {
		return err
	}

	if err := w.addTree(w.gitDir, repoChangeGit); err != nil {
		return err
	}

	return nil
}

func (w *repoWatcher) addTree(root string, kind repoChangeKind) error {
	return filepath.WalkDir(root, func(path string, entry fs.DirEntry, err error) error {
		if err != nil {
			return err
		}

		cleanPath := filepath.Clean(path)
		if kind == repoChangeWorktree && w.shouldSkipWorktreePath(cleanPath) {
			if cleanPath == root {
				return nil
			}
			return filepath.SkipDir
		}

		if !entry.IsDir() {
			return nil
		}

		if err := w.addWatch(cleanPath, kind); err != nil {
			return err
		}

		return nil
	})
}

func (w *repoWatcher) shouldSkipWorktreePath(path string) bool {
	if path != w.worktreeRoot && w.ignoredPaths != nil && w.ignoredPaths.matchesKnownPath(path) {
		return true
	}

	if w.gitDir == "" || !pathWithinRoot(w.gitDir, w.worktreeRoot) {
		return false
	}

	return pathWithinRoot(path, w.gitDir)
}

func (w *repoWatcher) addWatch(path string, kind repoChangeKind) error {
	if _, ok := w.watched[path]; ok {
		return nil
	}

	if err := w.watcher.Add(path); err != nil {
		return fmt.Errorf("watch %s: %w", path, err)
	}

	w.watched[path] = kind

	return nil
}

func (w *repoWatcher) run() {
	defer close(w.done)

	timer := time.NewTimer(time.Hour)
	if !timer.Stop() {
		<-timer.C
	}

	timerArmed := false
	pendingKind := repoChangeKind("")

	for {
		select {
		case event, ok := <-w.watcher.Events:
			if !ok {
				return
			}

			kind, changed := w.handleEvent(event)
			if !changed {
				continue
			}

			pendingKind = mergeRepoChangeKind(pendingKind, kind)
			resetRepoWatchTimer(timer, &timerArmed, w.debounce)
		case _, ok := <-w.watcher.Errors:
			if !ok {
				return
			}
		case <-timer.C:
			timerArmed = false
			if pendingKind == "" {
				continue
			}

			w.repoEvents.Publish(repoChangedEvent{Kind: pendingKind})
			pendingKind = ""
		}
	}
}

func (w *repoWatcher) handleEvent(event fsnotify.Event) (repoChangeKind, bool) {
	if event.Name == "" {
		return "", false
	}

	cleanPath := filepath.Clean(event.Name)
	if w.shouldIgnoreGitPath(cleanPath) {
		return "", false
	}
	if event.Op&(fsnotify.Remove|fsnotify.Rename) != 0 {
		w.removeWatchSubtree(cleanPath)
	}
	if w.shouldRefreshIgnoredPaths(cleanPath) {
		w.refreshIgnoredPaths()
	}

	kind, ok := w.classifyPath(cleanPath)
	if !ok {
		return "", false
	}
	if kind == repoChangeWorktree {
		if ignored := w.shouldIgnoreWorktreePath(cleanPath); ignored {
			return "", false
		}
	}

	if event.Op&fsnotify.Create != 0 {
		w.addCreatedDirectory(cleanPath, kind)
	}

	if kind == repoChangeGit && w.suppressingGitEvents() {
		return "", false
	}

	if event.Op&(fsnotify.Create|fsnotify.Write|fsnotify.Remove|fsnotify.Rename) == 0 {
		return "", false
	}

	return kind, true
}

func (w *repoWatcher) shouldIgnoreGitPath(path string) bool {
	if !pathWithinRoot(path, w.gitDir) {
		return false
	}

	return strings.HasSuffix(filepath.Base(path), ".lock")
}

func (w *repoWatcher) shouldIgnoreWorktreePath(path string) bool {
	if w.ignoredPaths == nil {
		return false
	}

	ignored, err := w.ignoredPaths.isIgnoredPath(path)
	return err == nil && ignored
}

func (w *repoWatcher) shouldRefreshIgnoredPaths(path string) bool {
	if filepath.Base(path) == ".gitignore" {
		return true
	}

	return filepath.Clean(path) == filepath.Join(w.gitDir, "info", "exclude")
}

func (w *repoWatcher) refreshIgnoredPaths() {
	if w.ignoredPaths == nil {
		return
	}

	if err := w.ignoredPaths.reload(); err != nil {
		return
	}

	for watchedPath, kind := range w.watched {
		if kind != repoChangeWorktree || watchedPath == w.worktreeRoot {
			continue
		}
		if !w.shouldSkipWorktreePath(watchedPath) {
			continue
		}

		_ = w.watcher.Remove(watchedPath)
		delete(w.watched, watchedPath)
	}

	_ = w.addTree(w.worktreeRoot, repoChangeWorktree)
}

func (w *repoWatcher) suppressGitEvents() func() {
	w.suppressMu.Lock()
	w.suppressGit++
	w.suppressMu.Unlock()

	return func() {
		w.suppressMu.Lock()
		if w.suppressGit > 0 {
			w.suppressGit--
		}
		w.suppressMu.Unlock()
	}
}

func (w *repoWatcher) suppressingGitEvents() bool {
	w.suppressMu.Lock()
	defer w.suppressMu.Unlock()

	return w.suppressGit > 0
}

func (w *repoWatcher) classifyPath(path string) (repoChangeKind, bool) {
	switch {
	case pathWithinRoot(path, w.gitDir):
		return repoChangeGit, true
	case pathWithinRoot(path, w.worktreeRoot):
		return repoChangeWorktree, true
	default:
		return "", false
	}
}

func (w *repoWatcher) addCreatedDirectory(path string, kind repoChangeKind) {
	info, err := os.Stat(path)
	if err != nil || !info.IsDir() {
		return
	}

	_ = w.addTree(path, kind)
}

func (w *repoWatcher) removeWatchSubtree(path string) {
	for watchedPath := range w.watched {
		if !pathWithinRoot(watchedPath, path) {
			continue
		}

		_ = w.watcher.Remove(watchedPath)
		delete(w.watched, watchedPath)
	}
}

func (w *repoWatcher) Close() error {
	var err error
	w.closeOnce.Do(func() {
		err = w.watcher.Close()
		<-w.done
	})

	return err
}
