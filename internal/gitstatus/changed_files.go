package gitstatus

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io/fs"
	"os/exec"
	"path/filepath"
	"strings"
)

func (s *Service) HeadCommit(ctx context.Context) (string, error) {
	cmd := exec.CommandContext(ctx, "git", "-C", s.repoRoot, "rev-parse", "HEAD")
	output, err := cmd.Output()
	if err != nil {
		return "", fmt.Errorf("git rev-parse HEAD: %w", err)
	}

	return strings.TrimSpace(string(output)), nil
}

func (s *Service) AllowsDiff(path, previousPath string) bool {
	return matchesScope(path, s.scopePath) || matchesScope(previousPath, s.scopePath)
}

func (s *Service) ListChangedFiles(ctx context.Context, baseRef string) (ChangedFilesResult, error) {
	comparison, err := s.resolveComparison(ctx, baseRef)
	if err != nil {
		return ChangedFilesResult{}, err
	}

	statusFiles, err := s.listStatusFiles(ctx)
	if err != nil {
		return ChangedFilesResult{}, err
	}

	branchSync, err := s.BranchSyncStatus(ctx)
	if err != nil {
		return ChangedFilesResult{}, err
	}

	var files []ChangedFileItem
	switch comparison.Mode {
	case ComparisonModeBranch:
		files, err = s.listFilesAgainstBase(ctx, comparison.BaseRef, statusFiles)
	default:
		files = statusFiles
	}
	if err != nil {
		return ChangedFilesResult{}, err
	}

	filteredFiles := make([]ChangedFileItem, 0, len(files))
	for _, file := range files {
		if s.AllowsDiff(file.Path, file.PreviousPath) {
			file.DisplayPath = displayPathForScope(file.Path, file.PreviousPath, s.scopePath)
			filteredFiles = append(filteredFiles, file)
		}
	}

	hiddenStagedFileCount := 0
	for _, file := range statusFiles {
		if file.HasStagedChanges && !s.AllowsDiff(file.Path, file.PreviousPath) {
			hiddenStagedFileCount++
		}
	}

	var initialDiff *FileDiffResult
	if len(filteredFiles) > 0 {
		diff, err := s.readFileDiffWithComparison(
			ctx,
			comparison,
			filteredFiles[0].Path,
			filteredFiles[0].Status,
			filteredFiles[0].PreviousPath,
		)
		if err != nil {
			return ChangedFilesResult{}, err
		}

		initialDiff = &diff
	}

	return ChangedFilesResult{
		Mode:                  comparison.Mode,
		BaseRef:               comparison.BaseRef,
		BaseCommit:            comparison.BaseCommit,
		CurrentRef:            comparison.CurrentRef,
		CurrentCommit:         comparison.CurrentCommit,
		UpstreamRef:           branchSync.UpstreamRef,
		BranchSync:            branchSync,
		RepoName:              filepath.Base(s.repoRoot),
		WorkspaceName:         workspaceNameForScope(s.repoRoot, s.scopePath),
		ScopePath:             s.scopePath,
		HiddenStagedFileCount: hiddenStagedFileCount,
		Files:                 filteredFiles,
		InitialDiff:           initialDiff,
	}, nil
}

func parsePorcelainStatus(output []byte, repoRoot string) ([]ChangedFileItem, error) {
	if len(output) == 0 {
		return []ChangedFileItem{}, nil
	}

	tokens := bytes.Split(output, []byte{0})
	files := make([]ChangedFileItem, 0, len(tokens))

	for index := 0; index < len(tokens); index++ {
		token := tokens[index]
		if len(token) == 0 {
			continue
		}
		if len(token) < 4 {
			return nil, fmt.Errorf("invalid status token %q", string(token))
		}

		code := string(token[:2])
		path := string(token[3:])
		if path == "" {
			return nil, fmt.Errorf("missing path for status token %q", string(token))
		}

		previousPath := ""
		if code[0] == 'R' || code[1] == 'R' {
			if index+1 < len(tokens) && len(tokens[index+1]) > 0 {
				previousPath = string(tokens[index+1])
				index++
			}
		}

		item := ChangedFileItem{
			ID:                 path,
			Path:               path,
			PreviousPath:       previousPath,
			Status:             mapChangedStatus(code),
			IsTracked:          code != "??",
			HasStagedChanges:   code[0] != ' ' && code[0] != '?',
			HasUnstagedChanges: code == "??" || (code[1] != ' ' && code[1] != '?'),
			ContentKey:         "missing",
			Language:           detectLanguage(path),
		}

		if key, err := buildContentKey(repoRoot, path); err == nil {
			item.ContentKey = key
		} else if !errors.Is(err, fs.ErrNotExist) {
			return nil, err
		}

		files = append(files, item)
	}

	return files, nil
}

func mapChangedStatus(code string) ChangedFileStatus {
	switch {
	case code == "??":
		return StatusAdded
	case strings.Contains(code, "R"):
		return StatusRenamed
	case strings.Contains(code, "D"):
		return StatusDeleted
	case strings.Contains(code, "A"):
		return StatusAdded
	default:
		return StatusModified
	}
}
