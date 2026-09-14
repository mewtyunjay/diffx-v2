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

	indexKey := buildIndexKey(repoRoot, relPath)

	return fmt.Sprintf("%d-%d:%s", info.Size(), info.ModTime().UnixNano(), indexKey), nil
}

func buildIndexKey(repoRoot, relPath string) string {
	cmd := exec.Command(
		"git",
		"-C",
		repoRoot,
		"ls-files",
		"-s",
		"-z",
		"--",
		relPath,
	)
	output, err := cmd.Output()
	if err != nil {
		return "index-unavailable"
	}
	if len(output) == 0 {
		return "index-missing"
	}

	return "index-" + hashContents(output)
}

func ResolveRepoPath(repoRoot, relPath string) (string, error) {
	cleanPath := filepath.Clean(relPath)
	if cleanPath == "." || cleanPath == "" {
		return "", ErrPathRequired
	}
	if filepath.IsAbs(cleanPath) {
		return "", ErrAbsolutePath
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
		return "", fmt.Errorf("%w: %q", ErrPathEscapesRepo, relPath)
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

func (s *Service) ReadFilePreview(relPath string) ([]byte, error) {
	absPath, err := ResolveRepoPath(s.repoRoot, relPath)
	if err != nil {
		return nil, err
	}

	return os.ReadFile(absPath)
}

func (s *Service) ReadConflictFile(relPath string) (ConflictFileResult, error) {
	if strings.TrimSpace(relPath) == "" {
		return ConflictFileResult{}, ErrPathRequired
	}

	absPath, err := ResolveRepoPath(s.repoRoot, relPath)
	if err != nil {
		return ConflictFileResult{}, err
	}

	info, err := os.Stat(absPath)
	if err != nil {
		if os.IsNotExist(err) {
			return ConflictFileResult{
				Path:       relPath,
				Exists:     false,
				Language:   detectLanguage(relPath),
				Contents:   "",
				ContentKey: "missing",
			}, nil
		}

		return ConflictFileResult{}, err
	}
	if info.IsDir() {
		return ConflictFileResult{}, fmt.Errorf("%w: %q", ErrNotAFile, relPath)
	}

	result, err := s.readWorkingTreeVersion(relPath)
	if err != nil {
		return ConflictFileResult{}, err
	}

	return ConflictFileResult{
		Path:       relPath,
		Exists:     true,
		Language:   detectLanguage(relPath),
		Contents:   result.version.Contents,
		ContentKey: result.version.CacheKey,
		Binary:     result.binary,
		TooLarge:   result.tooLarge,
	}, nil
}

func (s *Service) ResolveConflictFile(relPath string, contents string) (ConflictResolveResult, error) {
	if strings.TrimSpace(relPath) == "" {
		return ConflictResolveResult{}, ErrPathRequired
	}

	absPath, err := ResolveRepoPath(s.repoRoot, relPath)
	if err != nil {
		return ConflictResolveResult{}, err
	}

	parentDir := filepath.Dir(absPath)
	if err := os.MkdirAll(parentDir, 0o755); err != nil {
		return ConflictResolveResult{}, fmt.Errorf("create parent directory: %w", err)
	}

	if err := os.WriteFile(absPath, []byte(contents), 0o644); err != nil {
		return ConflictResolveResult{}, err
	}

	contentKey, err := buildContentKey(s.repoRoot, relPath)
	if err != nil {
		return ConflictResolveResult{}, err
	}

	return ConflictResolveResult{
		Path:       relPath,
		ContentKey: contentKey,
	}, nil
}

func (s *Service) ReadFileDiff(
	ctx context.Context,
	path string,
	status ChangedFileStatus,
	previousPath string,
	baseRef string,
) (FileDiffResult, error) {
	if path == "" {
		return FileDiffResult{}, ErrPathRequired
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
		return FileDiffResult{}, ErrPathRequired
	}
	if !status.IsValid() {
		return FileDiffResult{}, fmt.Errorf("invalid status %q", status)
	}

	beforePath := resolveBeforePath(path, previousPath)

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
		Before:        emptyFileVersion(beforePath),
		After:         emptyFileVersion(path),
	}
	if status == StatusRenamed && previousPath == "" {
		result.PreviousPath = path
	}

	before := func() (cachedFileVersion, error) {
		return s.readGitVersion(ctx, comparison.BaseCommit, beforePath)
	}
	after := func() (cachedFileVersion, error) {
		return s.readWorkingTreeVersion(path)
	}
	if status == StatusConflicted {
		before = func() (cachedFileVersion, error) {
			return s.readOptionalGitVersion(ctx, comparison.BaseCommit, beforePath)
		}
		after = func() (cachedFileVersion, error) {
			return s.readOptionalWorkingTreeVersion(path)
		}
	}

	versions, err := assembleFileDiffVersions(status, result.Before, result.After, before, after)
	if err != nil {
		return FileDiffResult{}, err
	}

	result.Before = versions.before
	result.After = versions.after
	result.Binary = versions.binary
	result.TooLarge = versions.tooLarge
	if comparison.Mode == ComparisonModeHead && status != StatusConflicted {
		indexResult, ok, err := s.readOptionalIndexVersion(ctx, path)
		if err != nil {
			return FileDiffResult{}, err
		}
		if ok && indexResult.version.CacheKey != result.Before.CacheKey {
			stagedAfter := indexResult.version
			result.StagedAfter = &stagedAfter
			result.Binary = result.Binary || indexResult.binary
			result.TooLarge = result.TooLarge || indexResult.tooLarge
		}
	}

	return result, nil
}

func (s *Service) readOptionalWorkingTreeVersion(relPath string) (cachedFileVersion, error) {
	result, err := s.readWorkingTreeVersion(relPath)
	if err == nil {
		return result, nil
	}
	if os.IsNotExist(err) {
		return cachedFileVersion{version: emptyFileVersion(relPath)}, nil
	}

	return cachedFileVersion{}, err
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

func (s *Service) readOptionalIndexVersion(
	ctx context.Context,
	relPath string,
) (cachedFileVersion, bool, error) {
	indexKey := buildIndexKey(s.repoRoot, relPath)
	if indexKey == "index-missing" {
		return cachedFileVersion{}, false, nil
	}

	cacheKey := fmt.Sprintf("index:%s:%s", relPath, indexKey)
	if cached, ok := s.versionCache.Get(cacheKey); ok {
		return cached, true, nil
	}

	cmd := exec.CommandContext(
		ctx,
		"git",
		"-C",
		s.repoRoot,
		"show",
		fmt.Sprintf(":%s", relPath),
	)
	contents, err := cmd.Output()
	if err != nil {
		if isGitPathMissingError(err) {
			return cachedFileVersion{}, false, nil
		}

		return cachedFileVersion{}, false, fmt.Errorf("git show :%s: %w", relPath, err)
	}

	result := buildCachedFileVersion(relPath, contents)
	s.versionCache.Set(cacheKey, result)

	return result, true, nil
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

func (s *Service) readOptionalGitVersion(
	ctx context.Context,
	headCommit string,
	relPath string,
) (cachedFileVersion, error) {
	result, err := s.readGitVersion(ctx, headCommit, relPath)
	if err == nil {
		return result, nil
	}

	if isGitPathMissingError(err) {
		return cachedFileVersion{version: emptyFileVersion(relPath)}, nil
	}

	return cachedFileVersion{}, err
}

func isGitPathMissingError(err error) bool {
	// `git show <commit>:<path>` emits one of these messages when the path is absent.
	message := err.Error()
	return strings.Contains(message, "exists on disk, but not in") ||
		strings.Contains(message, "not in the index") ||
		strings.Contains(message, "neither on disk nor in the index") ||
		strings.Contains(message, "path does not exist in")
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
