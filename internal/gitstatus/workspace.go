package gitstatus

import (
	"errors"
	"fmt"
	"os/exec"
	"path/filepath"
	"strings"
)

var ErrNotGitRepo = errors.New("directory is not inside a git repository")

type WorkspaceTarget struct {
	CWD       string
	RepoRoot  string
	ScopePath string
}

func ResolveWorkspaceTarget(cwd string) (WorkspaceTarget, error) {
	if strings.TrimSpace(cwd) == "" {
		return WorkspaceTarget{}, fmt.Errorf("cwd is required")
	}

	absoluteCWD, err := filepath.Abs(cwd)
	if err != nil {
		return WorkspaceTarget{}, fmt.Errorf("resolve cwd: %w", err)
	}
	if resolvedCWD, err := filepath.EvalSymlinks(absoluteCWD); err == nil {
		absoluteCWD = resolvedCWD
	}

	cmd := exec.Command("git", "-C", absoluteCWD, "rev-parse", "--show-toplevel")
	output, err := cmd.Output()
	if err != nil {
		return WorkspaceTarget{}, fmt.Errorf("%w: %s", ErrNotGitRepo, absoluteCWD)
	}

	repoRoot := strings.TrimSpace(string(output))
	if resolvedRepoRoot, err := filepath.EvalSymlinks(repoRoot); err == nil {
		repoRoot = resolvedRepoRoot
	}
	scopePath, err := filepath.Rel(repoRoot, absoluteCWD)
	if err != nil {
		return WorkspaceTarget{}, fmt.Errorf("derive scope path: %w", err)
	}

	return WorkspaceTarget{
		CWD:       absoluteCWD,
		RepoRoot:  repoRoot,
		ScopePath: normalizeScopePath(scopePath),
	}, nil
}
