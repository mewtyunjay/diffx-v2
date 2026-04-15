package gitstatus

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

func (s *Service) ReadMergeState(ctx context.Context, statusFiles []ChangedFileItem) (MergeState, error) {
	unresolvedCount := 0
	for _, file := range statusFiles {
		if file.Status == StatusConflicted {
			unresolvedCount++
		}
	}

	mergeHeadPath, err := s.resolveGitPath(ctx, "MERGE_HEAD")
	if err != nil {
		return MergeState{}, err
	}

	info, err := os.Stat(mergeHeadPath)
	if err != nil {
		if os.IsNotExist(err) {
			return MergeState{
				InProgress:      false,
				UnresolvedCount: 0,
			}, nil
		}

		return MergeState{}, fmt.Errorf("stat merge head: %w", err)
	}

	return MergeState{
		InProgress:      !info.IsDir(),
		UnresolvedCount: unresolvedCount,
	}, nil
}

func (s *Service) resolveGitPath(ctx context.Context, path string) (string, error) {
	output, err := s.runGitOutput(ctx, "rev-parse", "--git-path", path)
	if err != nil {
		return "", fmt.Errorf("git rev-parse --git-path %s: %w", path, err)
	}

	resolvedPath := strings.TrimSpace(string(output))
	if resolvedPath == "" {
		return "", fmt.Errorf("git path %s was empty", path)
	}

	if !filepath.IsAbs(resolvedPath) {
		resolvedPath = filepath.Join(s.repoRoot, resolvedPath)
	}

	return resolvedPath, nil
}
