package server

import (
	"bytes"
	"errors"
	"fmt"
	"os/exec"
	"path/filepath"
	"strings"
)

type repoIgnoreMatcher struct {
	repoRoot     string
	worktreeRoot string
	ignoredExact map[string]struct{}
	ignoredDirs  map[string]struct{}
	checked      map[string]bool
}

func newRepoIgnoreMatcher(repoRoot string, worktreeRoot string) (*repoIgnoreMatcher, error) {
	matcher := &repoIgnoreMatcher{
		repoRoot:     repoRoot,
		worktreeRoot: worktreeRoot,
	}

	if err := matcher.reload(); err != nil {
		return nil, err
	}

	return matcher, nil
}

func (m *repoIgnoreMatcher) reload() error {
	ignoredExact, ignoredDirs, err := listIgnoredPaths(m.repoRoot, m.worktreeRoot)
	if err != nil {
		return err
	}

	m.ignoredExact = ignoredExact
	m.ignoredDirs = ignoredDirs
	m.checked = make(map[string]bool, len(ignoredExact)+len(ignoredDirs))
	for path := range ignoredExact {
		m.checked[path] = true
	}
	for path := range ignoredDirs {
		m.checked[path] = true
	}

	return nil
}

func (m *repoIgnoreMatcher) matchesKnownPath(path string) bool {
	cleanPath := filepath.Clean(path)
	if !pathWithinRoot(cleanPath, m.worktreeRoot) {
		return false
	}

	if _, ok := m.ignoredExact[cleanPath]; ok {
		return true
	}
	for ignoredDir := range m.ignoredDirs {
		if pathWithinRoot(cleanPath, ignoredDir) {
			return true
		}
	}

	return false
}

func (m *repoIgnoreMatcher) isIgnoredPath(path string) (bool, error) {
	cleanPath := filepath.Clean(path)
	if !pathWithinRoot(cleanPath, m.worktreeRoot) {
		return false, nil
	}

	if ignored, ok := m.checked[cleanPath]; ok {
		return ignored, nil
	}
	if m.matchesKnownPath(cleanPath) {
		m.checked[cleanPath] = true
		return true, nil
	}

	ignored, err := gitCheckIgnoredPath(m.repoRoot, cleanPath)
	if err != nil {
		return false, err
	}

	m.checked[cleanPath] = ignored
	if ignored {
		m.ignoredExact[cleanPath] = struct{}{}
	}

	return ignored, nil
}

func listIgnoredPaths(repoRoot string, worktreeRoot string) (map[string]struct{}, map[string]struct{}, error) {
	scopePath, err := repoRelativePath(repoRoot, worktreeRoot)
	if err != nil {
		return nil, nil, err
	}

	commandArgs := []string{
		"-C", repoRoot,
		"ls-files",
		"--others",
		"-i",
		"--exclude-standard",
		"--directory",
		"-z",
		"--",
		scopePath,
	}
	output, err := exec.Command("git", commandArgs...).Output()
	if err != nil {
		return nil, nil, fmt.Errorf("list ignored paths: %w", err)
	}

	ignoredExact := make(map[string]struct{})
	ignoredDirs := make(map[string]struct{})
	for _, rawEntry := range bytes.Split(output, []byte{0}) {
		if len(rawEntry) == 0 {
			continue
		}
		entry := string(rawEntry)

		isDir := strings.HasSuffix(entry, "/")
		entry = strings.TrimSuffix(entry, "/")
		absolutePath := filepath.Clean(filepath.Join(repoRoot, filepath.FromSlash(entry)))
		if isDir {
			ignoredDirs[absolutePath] = struct{}{}
			continue
		}

		ignoredExact[absolutePath] = struct{}{}
	}

	return ignoredExact, ignoredDirs, nil
}

func gitCheckIgnoredPath(repoRoot string, path string) (bool, error) {
	relativePath, err := repoRelativePath(repoRoot, path)
	if err != nil {
		return false, err
	}

	commandArgs := []string{"-C", repoRoot, "check-ignore", "--quiet", "--no-index", "--", relativePath}
	cmd := exec.Command("git", commandArgs...)
	if err := cmd.Run(); err != nil {
		var exitErr *exec.ExitError
		if errors.As(err, &exitErr) {
			return false, nil
		}

		return false, fmt.Errorf("git check-ignore -- %s: %w", relativePath, err)
	}

	return true, nil
}

func repoRelativePath(repoRoot string, path string) (string, error) {
	relativePath, err := filepath.Rel(filepath.Clean(repoRoot), filepath.Clean(path))
	if err != nil {
		return "", fmt.Errorf("relative path from repo root: %w", err)
	}
	if relativePath == "." {
		return ".", nil
	}

	return filepath.ToSlash(relativePath), nil
}
