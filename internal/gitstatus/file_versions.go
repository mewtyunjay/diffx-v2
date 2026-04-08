package gitstatus

import (
	"bytes"
	"context"
	"crypto/sha1"
	"encoding/hex"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

func buildContentKey(repoRoot, relPath string) (string, error) {
	absPath, err := ResolveRepoPath(repoRoot, relPath)
	if err != nil {
		return "", err
	}

	info, err := os.Stat(absPath)
	if err != nil {
		return "", err
	}

	return fmt.Sprintf("%d-%d", info.Size(), info.ModTime().UnixNano()), nil
}

func ResolveRepoPath(repoRoot, relPath string) (string, error) {
	cleanPath := filepath.Clean(relPath)
	if cleanPath == "." || cleanPath == "" {
		return "", fmt.Errorf("path is required")
	}
	if filepath.IsAbs(cleanPath) {
		return "", fmt.Errorf("absolute paths are not allowed")
	}

	absPath := filepath.Join(repoRoot, cleanPath)
	absPath, err := filepath.Abs(absPath)
	if err != nil {
		return "", fmt.Errorf("resolve path: %w", err)
	}

	relToRoot, err := filepath.Rel(repoRoot, absPath)
	if err != nil {
		return "", fmt.Errorf("resolve path: %w", err)
	}
	if relToRoot == ".." || strings.HasPrefix(relToRoot, ".."+string(filepath.Separator)) {
		return "", fmt.Errorf("path %q escapes repo root", relPath)
	}

	return absPath, nil
}

func (s *Service) ReadFileContent(relPath string) (string, string, error) {
	result, err := s.readWorkingTreeVersion(relPath)
	if err != nil {
		return "", "", err
	}

	return result.version.Contents, result.version.CacheKey, nil
}

func (s *Service) ReadFileDiff(
	ctx context.Context,
	path string,
	status ChangedFileStatus,
	previousPath string,
	baseRef string,
) (FileDiffResult, error) {
	if path == "" {
		return FileDiffResult{}, fmt.Errorf("path is required")
	}
	if !status.IsValid() {
		return FileDiffResult{}, fmt.Errorf("invalid status %q", status)
	}

	comparison, err := s.resolveComparison(ctx, baseRef)
	if err != nil {
		return FileDiffResult{}, err
	}

	return s.readFileDiffWithComparison(ctx, comparison, path, status, previousPath)
}

func (s *Service) readFileDiffWithComparison(
	ctx context.Context,
	comparison comparisonInfo,
	path string,
	status ChangedFileStatus,
	previousPath string,
) (FileDiffResult, error) {
	if path == "" {
		return FileDiffResult{}, fmt.Errorf("path is required")
	}
	if !status.IsValid() {
		return FileDiffResult{}, fmt.Errorf("invalid status %q", status)
	}

	beforeName := path
	if previousPath != "" {
		beforeName = previousPath
	}

	result := FileDiffResult{
		Mode:          comparison.Mode,
		BaseRef:       comparison.BaseRef,
		BaseCommit:    comparison.BaseCommit,
		CurrentRef:    comparison.CurrentRef,
		CurrentCommit: comparison.CurrentCommit,
		Path:          path,
		PreviousPath:  previousPath,
		Status:        status,
		Language:      detectLanguage(path),
		Before:        emptyFileVersion(beforeName),
		After:         emptyFileVersion(path),
	}

	var beforeResult cachedFileVersion
	var afterResult cachedFileVersion
	var err error

	switch status {
	case StatusAdded:
		afterResult, err = s.readWorkingTreeVersion(path)
		if err != nil {
			return FileDiffResult{}, err
		}
		result.After = afterResult.version
	case StatusDeleted:
		beforeResult, err = s.readGitVersion(ctx, comparison.BaseCommit, path)
		if err != nil {
			return FileDiffResult{}, err
		}
		result.Before = beforeResult.version
	case StatusRenamed:
		beforePath := previousPath
		if beforePath == "" {
			beforePath = path
			result.PreviousPath = beforePath
		}

		beforeResult, err = s.readGitVersion(ctx, comparison.BaseCommit, beforePath)
		if err != nil {
			return FileDiffResult{}, err
		}
		afterResult, err = s.readWorkingTreeVersion(path)
		if err != nil {
			return FileDiffResult{}, err
		}

		result.Before = beforeResult.version
		result.After = afterResult.version
	default:
		beforeResult, err = s.readGitVersion(ctx, comparison.BaseCommit, path)
		if err != nil {
			return FileDiffResult{}, err
		}
		afterResult, err = s.readWorkingTreeVersion(path)
		if err != nil {
			return FileDiffResult{}, err
		}

		result.Before = beforeResult.version
		result.After = afterResult.version
	}

	result.Binary = beforeResult.binary || afterResult.binary
	result.TooLarge = beforeResult.tooLarge || afterResult.tooLarge

	return result, nil
}

func (s *Service) readWorkingTreeVersion(relPath string) (cachedFileVersion, error) {
	absPath, err := ResolveRepoPath(s.repoRoot, relPath)
	if err != nil {
		return cachedFileVersion{}, err
	}

	info, err := os.Stat(absPath)
	if err != nil {
		return cachedFileVersion{}, err
	}

	cacheKey := fmt.Sprintf(
		"worktree:%s:%d-%d",
		relPath,
		info.Size(),
		info.ModTime().UnixNano(),
	)
	if cached, ok := s.versionCache.Get(cacheKey); ok {
		return cached, nil
	}

	contents, err := os.ReadFile(absPath)
	if err != nil {
		return cachedFileVersion{}, err
	}

	result := buildCachedFileVersion(relPath, contents)
	s.versionCache.Set(cacheKey, result)

	return result, nil
}

func (s *Service) readGitVersion(
	ctx context.Context,
	headCommit string,
	relPath string,
) (cachedFileVersion, error) {
	cacheKey := fmt.Sprintf("git:%s:%s", headCommit, relPath)
	if cached, ok := s.versionCache.Get(cacheKey); ok {
		return cached, nil
	}

	cmd := exec.CommandContext(
		ctx,
		"git",
		"-C",
		s.repoRoot,
		"show",
		fmt.Sprintf("%s:%s", headCommit, relPath),
	)
	contents, err := cmd.Output()
	if err != nil {
		return cachedFileVersion{}, fmt.Errorf("git show %s:%s: %w", headCommit, relPath, err)
	}

	result := buildCachedFileVersion(relPath, contents)
	s.versionCache.Set(cacheKey, result)

	return result, nil
}

func buildCachedFileVersion(name string, contents []byte) cachedFileVersion {
	result := cachedFileVersion{
		version: FileVersion{
			Name:     name,
			CacheKey: hashContents(contents),
		},
	}

	if len(contents) > maxDiffFileBytes {
		result.tooLarge = true
		return result
	}

	if bytes.IndexByte(contents, 0) >= 0 {
		result.binary = true
		return result
	}

	normalized := bytes.ToValidUTF8(contents, []byte("\uFFFD"))
	result.version.Contents = string(normalized)
	result.version.CacheKey = hashContents(normalized)

	return result
}

func emptyFileVersion(name string) FileVersion {
	return FileVersion{
		Name:     name,
		Contents: "",
		CacheKey: emptyContentHash,
	}
}

func hashContents(contents []byte) string {
	hash := sha1.Sum(contents)
	return hex.EncodeToString(hash[:])
}
