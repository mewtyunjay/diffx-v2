package server

import (
	"context"
	"sync"

	githubservice "diffx/internal/github"
	"diffx/internal/gitstatus"
)

type pullRequestMetadataReader interface {
	ReadPullRequestMetadata(ctx context.Context, number int) (githubservice.PullRequestDetailMetadata, error)
}

type pullRequestDiffReader interface {
	ScopePath() string
	ReadPullRequestDiff(ctx context.Context, refs gitstatus.PullRequestRefs) (gitstatus.PullRequestDiffResult, error)
	ReadPreparedPullRequestFileDiff(
		ctx context.Context,
		localRefs gitstatus.PullRequestDiffContext,
		path string,
		status gitstatus.ChangedFileStatus,
		previousPath string,
	) (gitstatus.FileDiffResult, error)
}

type pullRequestReview struct {
	github pullRequestMetadataReader
	git    pullRequestDiffReader
	mu     sync.RWMutex
	cache  map[int]gitstatus.PullRequestDiffContext
}

type pullRequestReviewDetail struct {
	Metadata          githubservice.PullRequestDetailMetadata
	Files             []gitstatus.ChangedFileItem
	OutsideScopeCount int
	ScopePath         string
	LocalDiffError    error
}

func newPullRequestReview(github pullRequestMetadataReader, git pullRequestDiffReader) *pullRequestReview {
	return &pullRequestReview{
		github: github,
		git:    git,
		cache:  make(map[int]gitstatus.PullRequestDiffContext),
	}
}

func (r *pullRequestReview) LoadDetail(ctx context.Context, number int) (pullRequestReviewDetail, error) {
	metadata, err := r.github.ReadPullRequestMetadata(ctx, number)
	if err != nil {
		return pullRequestReviewDetail{}, err
	}

	detail := pullRequestReviewDetail{
		Metadata:  metadata,
		Files:     []gitstatus.ChangedFileItem{},
		ScopePath: r.git.ScopePath(),
	}

	diffResult, err := r.git.ReadPullRequestDiff(ctx, metadataToGitstatusRefs(metadata))
	if err != nil {
		r.forget(number)
		detail.LocalDiffError = err
		return detail, nil
	}

	detail.Files = diffResult.Files
	detail.OutsideScopeCount = diffResult.OutsideScopeCount
	detail.ScopePath = diffResult.ScopePath
	r.store(number, diffResult.PullRequestDiffContext)

	return detail, nil
}

func (r *pullRequestReview) FileDiff(
	ctx context.Context,
	number int,
	path string,
	status gitstatus.ChangedFileStatus,
	previousPath string,
) (gitstatus.FileDiffResult, error) {
	localRefs, ok := r.read(number)
	if !ok {
		metadata, err := r.github.ReadPullRequestMetadata(ctx, number)
		if err != nil {
			return gitstatus.FileDiffResult{}, err
		}

		diffResult, err := r.git.ReadPullRequestDiff(ctx, metadataToGitstatusRefs(metadata))
		if err != nil {
			return gitstatus.FileDiffResult{}, err
		}

		localRefs = diffResult.PullRequestDiffContext
		r.store(number, localRefs)
	}

	return r.git.ReadPreparedPullRequestFileDiff(ctx, localRefs, path, status, previousPath)
}

func (r *pullRequestReview) Forget(number int) {
	r.forget(number)
}

func (r *pullRequestReview) store(number int, context gitstatus.PullRequestDiffContext) {
	if number <= 0 {
		return
	}

	r.mu.Lock()
	defer r.mu.Unlock()
	r.cache[number] = context
}

func (r *pullRequestReview) read(number int) (gitstatus.PullRequestDiffContext, bool) {
	if number <= 0 {
		return gitstatus.PullRequestDiffContext{}, false
	}

	r.mu.RLock()
	defer r.mu.RUnlock()
	context, ok := r.cache[number]
	return context, ok
}

func (r *pullRequestReview) forget(number int) {
	if number <= 0 {
		return
	}

	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.cache, number)
}

func metadataToGitstatusRefs(metadata githubservice.PullRequestDetailMetadata) gitstatus.PullRequestRefs {
	return gitstatus.PullRequestRefs{
		Number:              metadata.PR.Number,
		BaseRefName:         metadata.Base.RefName,
		BaseSHA:             metadata.Base.SHA,
		HeadRefName:         metadata.Head.RefName,
		HeadSHA:             metadata.Head.SHA,
		HeadRepositoryOwner: metadata.Head.RepositoryOwner,
		HeadRepositoryName:  metadata.Head.RepositoryName,
	}
}
