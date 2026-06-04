package gitstatus

import (
	"context"
	"fmt"
	"strings"
)

type PullRequestRefs struct {
	Number              int
	BaseRefName         string
	BaseSHA             string
	HeadRefName         string
	HeadSHA             string
	HeadRepositoryOwner string
	HeadRepositoryName  string
}

type PullRequestDiffResult struct {
	BaseRef           string
	HeadRef           string
	MergeBase         string
	BaseCommit        string
	HeadCommit        string
	Files             []ChangedFileItem
	ScopePath         string
	OutsideScopeCount int
}

func (s *Service) ReadPullRequestDiff(
	ctx context.Context,
	refs PullRequestRefs,
) (PullRequestDiffResult, error) {
	localRefs, err := s.preparePullRequestRefs(ctx, refs)
	if err != nil {
		return PullRequestDiffResult{}, err
	}

	files, outsideScopeCount, err := s.listPullRequestFiles(ctx, localRefs.MergeBase, localRefs.HeadRef)
	if err != nil {
		return PullRequestDiffResult{}, err
	}

	localRefs.Files = files
	localRefs.ScopePath = s.scopePath
	localRefs.OutsideScopeCount = outsideScopeCount
	return localRefs, nil
}

func (s *Service) ReadPullRequestFileDiff(
	ctx context.Context,
	refs PullRequestRefs,
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
		return FileDiffResult{}, fmt.Errorf("invalid pull request file status %q", status)
	}

	localRefs, err := s.preparePullRequestRefs(ctx, refs)
	if err != nil {
		return FileDiffResult{}, err
	}

	return s.readPullRequestObjectDiff(
		ctx,
		localRefs.MergeBase,
		localRefs.HeadRef,
		localRefs.HeadCommit,
		path,
		status,
		previousPath,
	)
}

func (s *Service) preparePullRequestRefs(
	ctx context.Context,
	refs PullRequestRefs,
) (PullRequestDiffResult, error) {
	if refs.Number <= 0 {
		return PullRequestDiffResult{}, fmt.Errorf("pull request number is required")
	}

	baseRef := pullRequestBaseRef(refs.Number)
	headRef := pullRequestHeadRef(refs.Number)
	if !s.localPullRequestRefsCurrent(ctx, refs, baseRef, headRef) {
		if err := s.fetchPullRequestRefs(ctx, refs, baseRef, headRef); err != nil {
			return PullRequestDiffResult{}, err
		}
	}

	baseCommit, err := s.resolveCommit(ctx, baseRef)
	if err != nil {
		return PullRequestDiffResult{}, err
	}
	headCommit, err := s.resolveCommit(ctx, headRef)
	if err != nil {
		return PullRequestDiffResult{}, err
	}

	mergeBaseOutput, err := s.runGitOutput(ctx, "merge-base", baseRef, headRef)
	if err != nil {
		return PullRequestDiffResult{}, fmt.Errorf("git merge-base %s %s: %w", baseRef, headRef, err)
	}
	mergeBase := strings.TrimSpace(string(mergeBaseOutput))
	if mergeBase == "" {
		return PullRequestDiffResult{}, fmt.Errorf("git merge-base returned an empty merge base")
	}

	return PullRequestDiffResult{
		BaseRef:    baseRef,
		HeadRef:    headRef,
		MergeBase:  mergeBase,
		BaseCommit: baseCommit,
		HeadCommit: headCommit,
	}, nil
}

func (s *Service) localPullRequestRefsCurrent(
	ctx context.Context,
	refs PullRequestRefs,
	baseRef string,
	headRef string,
) bool {
	baseCommit, err := s.resolveCommit(ctx, baseRef)
	if err != nil {
		return false
	}
	headCommit, err := s.resolveCommit(ctx, headRef)
	if err != nil {
		return false
	}

	if refs.BaseSHA != "" && baseCommit != refs.BaseSHA {
		return false
	}
	if refs.HeadSHA != "" && headCommit != refs.HeadSHA {
		return false
	}

	return true
}

func (s *Service) listPullRequestFiles(
	ctx context.Context,
	mergeBase string,
	headRef string,
) ([]ChangedFileItem, int, error) {
	output, err := s.runGitOutput(
		ctx,
		"diff",
		"--name-status",
		"-z",
		"-M",
		mergeBase,
		headRef,
		"--",
	)
	if err != nil {
		return nil, 0, fmt.Errorf("git diff --name-status %s %s: %w", mergeBase, headRef, err)
	}

	files, err := parseNameStatusObjectDiff(output)
	if err != nil {
		return nil, 0, err
	}

	filteredFiles := make([]ChangedFileItem, 0, len(files))
	outsideScopeCount := 0
	for _, file := range files {
		file.DisplayPath = displayPathForScope(file.Path, file.PreviousPath, s.scopePath)
		file.ContentKey = pullRequestFileContentKey(mergeBase, headRef, file)
		if s.AllowsDiff(file.Path, file.PreviousPath) {
			filteredFiles = append(filteredFiles, file)
		} else {
			outsideScopeCount++
		}
	}

	return filteredFiles, outsideScopeCount, nil
}

func pullRequestBaseRef(number int) string {
	return fmt.Sprintf("refs/diffx/pr/%d/base", number)
}

func pullRequestHeadRef(number int) string {
	return fmt.Sprintf("refs/diffx/pr/%d/head", number)
}
