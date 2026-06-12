package server

import (
	"context"
	"errors"
	"testing"

	githubservice "diffx/internal/github"
	"diffx/internal/gitstatus"
)

type fakeMetadataReader struct {
	metadata githubservice.PullRequestDetailMetadata
	err      error
	calls    int
}

func (f *fakeMetadataReader) ReadPullRequestMetadata(_ context.Context, number int) (githubservice.PullRequestDetailMetadata, error) {
	f.calls++
	if f.err != nil {
		return githubservice.PullRequestDetailMetadata{}, f.err
	}

	f.metadata.PR.Number = number
	return f.metadata, nil
}

type fakeDiffReader struct {
	diff         gitstatus.PullRequestDiffResult
	diffErr      error
	prepared     gitstatus.FileDiffResult
	preparedErr  error
	scopePath    string
	diffCalls    int
	prepareCalls int
}

func (f *fakeDiffReader) ScopePath() string { return f.scopePath }

func (f *fakeDiffReader) ReadPullRequestDiff(_ context.Context, _ gitstatus.PullRequestRefs) (gitstatus.PullRequestDiffResult, error) {
	f.diffCalls++
	if f.diffErr != nil {
		return gitstatus.PullRequestDiffResult{}, f.diffErr
	}

	return f.diff, nil
}

func (f *fakeDiffReader) ReadPreparedPullRequestFileDiff(
	_ context.Context,
	_ gitstatus.PullRequestDiffContext,
	_ string,
	_ gitstatus.ChangedFileStatus,
	_ string,
) (gitstatus.FileDiffResult, error) {
	f.prepareCalls++
	if f.preparedErr != nil {
		return gitstatus.FileDiffResult{}, f.preparedErr
	}

	return f.prepared, nil
}

func TestPullRequestReviewLoadDetailCachesContext(t *testing.T) {
	metadata := &fakeMetadataReader{}
	diff := &fakeDiffReader{
		scopePath: "scope",
		diff: gitstatus.PullRequestDiffResult{
			PullRequestDiffContext: gitstatus.PullRequestDiffContext{HeadCommit: "abc"},
			Files:                  []gitstatus.ChangedFileItem{{Path: "a.go"}},
			ScopePath:              "scope",
			OutsideScopeCount:      2,
		},
	}
	review := newPullRequestReview(metadata, diff)

	detail, err := review.LoadDetail(context.Background(), 7)
	if err != nil {
		t.Fatalf("LoadDetail: %v", err)
	}
	if detail.LocalDiffError != nil {
		t.Fatalf("unexpected local diff error: %v", detail.LocalDiffError)
	}
	if len(detail.Files) != 1 || detail.OutsideScopeCount != 2 || detail.ScopePath != "scope" {
		t.Fatalf("detail not populated from diff result: %+v", detail)
	}

	if _, err := review.FileDiff(context.Background(), 7, "a.go", gitstatus.StatusModified, ""); err != nil {
		t.Fatalf("FileDiff: %v", err)
	}

	if diff.diffCalls != 1 {
		t.Fatalf("expected diff resolved once (cache hit on file diff), got %d", diff.diffCalls)
	}
	if diff.prepareCalls != 1 {
		t.Fatalf("expected one prepared file diff, got %d", diff.prepareCalls)
	}
}

func TestPullRequestReviewLoadDetailSoftFailsOnDiffError(t *testing.T) {
	metadata := &fakeMetadataReader{}
	diff := &fakeDiffReader{scopePath: "scope", diffErr: errors.New("no local refs")}
	review := newPullRequestReview(metadata, diff)

	detail, err := review.LoadDetail(context.Background(), 3)
	if err != nil {
		t.Fatalf("LoadDetail should not hard-fail on diff error: %v", err)
	}
	if detail.LocalDiffError == nil {
		t.Fatal("expected LocalDiffError to be set")
	}
	if detail.ScopePath != "scope" {
		t.Fatalf("expected fallback scope path, got %q", detail.ScopePath)
	}

	if _, ok := review.read(3); ok {
		t.Fatal("failed diff must not populate the cache")
	}
}

func TestPullRequestReviewFileDiffResolvesOnCacheMiss(t *testing.T) {
	metadata := &fakeMetadataReader{}
	diff := &fakeDiffReader{
		diff: gitstatus.PullRequestDiffResult{
			PullRequestDiffContext: gitstatus.PullRequestDiffContext{HeadCommit: "abc"},
		},
	}
	review := newPullRequestReview(metadata, diff)

	if _, err := review.FileDiff(context.Background(), 9, "a.go", gitstatus.StatusModified, ""); err != nil {
		t.Fatalf("FileDiff: %v", err)
	}

	if metadata.calls != 1 || diff.diffCalls != 1 {
		t.Fatalf("cache miss should resolve metadata and diff once: metadata=%d diff=%d", metadata.calls, diff.diffCalls)
	}

	review.Forget(9)
	if _, err := review.FileDiff(context.Background(), 9, "a.go", gitstatus.StatusModified, ""); err != nil {
		t.Fatalf("FileDiff after forget: %v", err)
	}
	if diff.diffCalls != 2 {
		t.Fatalf("Forget should force re-resolution, got diffCalls=%d", diff.diffCalls)
	}
}
