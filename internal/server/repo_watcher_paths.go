package server

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"diffx/internal/gitstatus"
)

func resolveRepoWatchRoots(workspace gitstatus.WorkspaceTarget) (repoWatchRoots, error) {
	worktreeRoot := workspace.RepoRoot
	if workspace.ScopePath != "." && workspace.ScopePath != "" {
		worktreeRoot = filepath.Join(workspace.RepoRoot, filepath.FromSlash(workspace.ScopePath))
	}

	worktreeRoot, err := resolveExistingDirectory(worktreeRoot)
	if err != nil {
		return repoWatchRoots{}, fmt.Errorf("resolve workspace scope root: %w", err)
	}

	gitDir, err := resolveGitDir(workspace.RepoRoot)
	if err != nil {
		return repoWatchRoots{}, err
	}

	return repoWatchRoots{
		worktreeRoot: worktreeRoot,
		gitDir:       gitDir,
	}, nil
}

func resolveGitDir(repoRoot string) (string, error) {
	output, err := exec.Command("git", "-C", repoRoot, "rev-parse", "--git-dir").Output()
	if err != nil {
		return "", fmt.Errorf("resolve git dir: %w", err)
	}

	gitDir := strings.TrimSpace(string(output))
	if !filepath.IsAbs(gitDir) {
		gitDir = filepath.Join(repoRoot, gitDir)
	}

	resolvedGitDir, err := resolveExistingDirectory(gitDir)
	if err != nil {
		return "", fmt.Errorf("resolve git dir: %w", err)
	}

	return resolvedGitDir, nil
}

func resolveExistingDirectory(path string) (string, error) {
	absolutePath, err := filepath.Abs(path)
	if err != nil {
		return "", err
	}

	if resolvedPath, err := filepath.EvalSymlinks(absolutePath); err == nil {
		absolutePath = resolvedPath
	}

	info, err := os.Stat(absolutePath)
	if err != nil {
		return "", err
	}
	if !info.IsDir() {
		return "", fmt.Errorf("%s is not a directory", absolutePath)
	}

	return absolutePath, nil
}

func pathWithinRoot(path string, root string) bool {
	if path == "" || root == "" {
		return false
	}

	cleanPath := filepath.Clean(path)
	cleanRoot := filepath.Clean(root)

	relativePath, err := filepath.Rel(cleanRoot, cleanPath)
	if err != nil {
		return false
	}

	if relativePath == "." {
		return true
	}

	return relativePath != ".." && !strings.HasPrefix(relativePath, ".."+string(filepath.Separator))
}
