package gitstatus

import (
	"bytes"
	"context"
	"fmt"
	"strconv"
	"strings"
)

const (
	defaultCommitLimit = 100
	maxCommitLimit     = 500
	commitFieldSep     = byte(0x1f)
	commitRecordSep    = byte(0x1e)
	emptyTreeHash      = "4b825dc642cb6eb9a060e54bf8d69288fbee4904"
)

func (s *Service) ListCommits(ctx context.Context, limit int, offset int) (CommitsResult, error) {
	currentRef, err := s.CurrentRef(ctx)
	if err != nil {
		return CommitsResult{}, err
	}

	commitLimit := normalizeCommitLimit(limit)
	commitOffset := normalizeCommitOffset(offset)
	output, err := s.runGitOutput(
		ctx,
		"log",
		"HEAD",
		"--max-count="+strconv.Itoa(commitLimit+1),
		"--skip="+strconv.Itoa(commitOffset),
		"--format=%H%x1f%h%x1f%s%x1f%an%x1f%aI%x1e",
	)
	if err != nil {
		return CommitsResult{}, fmt.Errorf("git log HEAD: %w", err)
	}

	commits, err := parseCommitLog(output)
	if err != nil {
		return CommitsResult{}, err
	}

	hasMore := len(commits) > commitLimit
	if hasMore {
		commits = commits[:commitLimit]
	}

	return CommitsResult{
		CurrentRef: currentRef,
		Commits:    commits,
		Offset:     commitOffset,
		NextOffset: commitOffset + len(commits),
		HasMore:    hasMore,
	}, nil
}

func (s *Service) ReadCommitDetail(ctx context.Context, hash string) (CommitDetailResult, error) {
	commitHash, err := s.resolveCommit(ctx, hash)
	if err != nil {
		return CommitDetailResult{}, err
	}

	currentRef, err := s.CurrentRef(ctx)
	if err != nil {
		return CommitDetailResult{}, err
	}

	commit, err := s.readCommitItem(ctx, commitHash)
	if err != nil {
		return CommitDetailResult{}, err
	}

	parentHash, err := s.firstParentOrEmptyTree(ctx, commitHash)
	if err != nil {
		return CommitDetailResult{}, err
	}

	files, err := s.listCommitFiles(ctx, parentHash, commitHash)
	if err != nil {
		return CommitDetailResult{}, err
	}

	return CommitDetailResult{
		Kind:       "commit",
		Commit:     commit,
		ParentHash: parentHash,
		CurrentRef: currentRef,
		Files:      files,
	}, nil
}

func (s *Service) ReadCommitFileDiff(
	ctx context.Context,
	hash string,
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
	if status == StatusConflicted {
		return FileDiffResult{}, fmt.Errorf("invalid commit file status %q", status)
	}

	commitHash, err := s.resolveCommit(ctx, hash)
	if err != nil {
		return FileDiffResult{}, err
	}

	parentHash, err := s.firstParentOrEmptyTree(ctx, commitHash)
	if err != nil {
		return FileDiffResult{}, err
	}

	beforeName := path
	if previousPath != "" {
		beforeName = previousPath
	}

	result := FileDiffResult{
		Mode:          ComparisonModeBranch,
		BaseRef:       parentHash,
		BaseCommit:    parentHash,
		CurrentRef:    shortCommitHash(commitHash),
		CurrentCommit: commitHash,
		Path:          path,
		PreviousPath:  previousPath,
		Status:        status,
		Language:      detectLanguage(path),
		Before:        emptyFileVersion(beforeName),
		After:         emptyFileVersion(path),
	}

	var beforeResult cachedFileVersion
	var afterResult cachedFileVersion

	switch status {
	case StatusAdded:
		afterResult, err = s.readGitVersion(ctx, commitHash, path)
		if err != nil {
			return FileDiffResult{}, err
		}
		result.After = afterResult.version
	case StatusDeleted:
		beforeResult, err = s.readGitVersion(ctx, parentHash, path)
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

		err = runParallel(
			func() error {
				var readErr error
				beforeResult, readErr = s.readGitVersion(ctx, parentHash, beforePath)
				return readErr
			},
			func() error {
				var readErr error
				afterResult, readErr = s.readGitVersion(ctx, commitHash, path)
				return readErr
			},
		)
		if err != nil {
			return FileDiffResult{}, err
		}
		result.Before = beforeResult.version
		result.After = afterResult.version
	default:
		err = runParallel(
			func() error {
				var readErr error
				beforeResult, readErr = s.readGitVersion(ctx, parentHash, path)
				return readErr
			},
			func() error {
				var readErr error
				afterResult, readErr = s.readGitVersion(ctx, commitHash, path)
				return readErr
			},
		)
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

func (s *Service) readCommitItem(ctx context.Context, hash string) (CommitItem, error) {
	output, err := s.runGitOutput(
		ctx,
		"log",
		"-1",
		hash,
		"--format=%H%x1f%h%x1f%s%x1f%an%x1f%aI%x1e",
	)
	if err != nil {
		return CommitItem{}, fmt.Errorf("git log -1 %s: %w", hash, err)
	}

	commits, err := parseCommitLog(output)
	if err != nil {
		return CommitItem{}, err
	}
	if len(commits) != 1 {
		return CommitItem{}, fmt.Errorf("commit %s not found", hash)
	}

	return commits[0], nil
}

func (s *Service) firstParentOrEmptyTree(ctx context.Context, hash string) (string, error) {
	output, err := s.runGitOutput(ctx, "rev-list", "--parents", "-n", "1", hash)
	if err != nil {
		return "", fmt.Errorf("git rev-list --parents -n 1 %s: %w", hash, err)
	}

	fields := strings.Fields(string(output))
	if len(fields) == 0 {
		return "", fmt.Errorf("commit %s not found", hash)
	}
	if len(fields) == 1 {
		return emptyTreeHash, nil
	}

	return fields[1], nil
}

func (s *Service) listCommitFiles(ctx context.Context, parentHash string, commitHash string) ([]ChangedFileItem, error) {
	output, err := s.runGitOutput(
		ctx,
		"diff",
		"--name-status",
		"-z",
		"-M",
		parentHash,
		commitHash,
		"--",
	)
	if err != nil {
		return nil, fmt.Errorf("git diff --name-status %s %s: %w", parentHash, commitHash, err)
	}

	files, err := parseNameStatusDiff(output, s.repoRoot)
	if err != nil {
		return nil, err
	}

	filteredFiles := make([]ChangedFileItem, 0, len(files))
	for _, file := range files {
		if !s.AllowsDiff(file.Path, file.PreviousPath) {
			continue
		}

		file.DisplayPath = displayPathForScope(file.Path, file.PreviousPath, s.scopePath)
		file.HasStagedChanges = false
		file.HasUnstagedChanges = false
		file.ContentKey = commitFileContentKey(parentHash, commitHash, file)
		filteredFiles = append(filteredFiles, file)
	}

	return filteredFiles, nil
}

func commitFileContentKey(parentHash string, commitHash string, file ChangedFileItem) string {
	if file.Status == StatusDeleted {
		path := file.Path
		if file.PreviousPath != "" {
			path = file.PreviousPath
		}

		return fmt.Sprintf("git:%s:%s", parentHash, path)
	}

	return fmt.Sprintf("git:%s:%s", commitHash, file.Path)
}

func normalizeCommitLimit(limit int) int {
	if limit <= 0 {
		return defaultCommitLimit
	}

	if limit > maxCommitLimit {
		return maxCommitLimit
	}

	return limit
}

func normalizeCommitOffset(offset int) int {
	if offset < 0 {
		return 0
	}

	return offset
}

func shortCommitHash(hash string) string {
	if len(hash) > 12 {
		return hash[:12]
	}

	return hash
}

func parseCommitLog(output []byte) ([]CommitItem, error) {
	records := bytes.Split(output, []byte{commitRecordSep})
	commits := make([]CommitItem, 0, len(records))

	for _, record := range records {
		record = bytes.Trim(record, "\n\r")
		if len(record) == 0 {
			continue
		}

		fields := bytes.Split(record, []byte{commitFieldSep})
		if len(fields) != 5 {
			return nil, fmt.Errorf("invalid commit log record")
		}

		commits = append(commits, CommitItem{
			Hash:       string(fields[0]),
			ShortHash:  string(fields[1]),
			Subject:    string(fields[2]),
			AuthorName: string(fields[3]),
			AuthorDate: string(fields[4]),
		})
	}

	return commits, nil
}
