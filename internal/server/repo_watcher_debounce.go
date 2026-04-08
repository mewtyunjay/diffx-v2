package server

import "time"

func mergeRepoChangeKind(current repoChangeKind, next repoChangeKind) repoChangeKind {
	switch {
	case current == repoChangeGit || next == repoChangeGit:
		return repoChangeGit
	case current == repoChangeWorktree || next == repoChangeWorktree:
		return repoChangeWorktree
	default:
		return next
	}
}

func resetRepoWatchTimer(timer *time.Timer, armed *bool, delay time.Duration) {
	if *armed && !timer.Stop() {
		select {
		case <-timer.C:
		default:
		}
	}

	timer.Reset(delay)
	*armed = true
}
