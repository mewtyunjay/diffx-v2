package github

import (
	"context"
	"errors"
	"fmt"
	"os/exec"
	"strconv"
	"strings"
	"time"
)

const (
	ghCommandTimeout = 20 * time.Second
	prListFields     = "number,title,url,author,isDraft,baseRefName,headRefName,headRepositoryOwner,headRepository,updatedAt,createdAt,labels,reviewDecision,changedFiles,statusCheckRollup"
	prDetailFields   = "number,title,url,author,body,state,isDraft,baseRefName,baseRefOid,headRefName,headRefOid,headRepositoryOwner,headRepository,createdAt,updatedAt,labels,reviewDecision,reviewRequests,latestReviews,comments,commits,changedFiles,mergeable,mergeStateStatus,statusCheckRollup"
	repoFields       = "name,owner,url,mergeCommitAllowed,squashMergeAllowed,rebaseMergeAllowed,viewerDefaultMergeMethod"
)

type Service struct {
	repoRoot string
	timeout  time.Duration
}

func NewService(repoRoot string) *Service {
	return &Service{
		repoRoot: repoRoot,
		timeout:  ghCommandTimeout,
	}
}

func (s *Service) ListOpenPullRequests(ctx context.Context) (PullRequestsResult, error) {
	repo, state := s.integrationState(ctx)
	if state.Status != IntegrationOK {
		return PullRequestsResult{
			Repo:  repo,
			PRs:   []PullRequestListItem{},
			State: state,
		}, nil
	}

	output, err := s.runGH(ctx, "pr", "list", "--state", "open", "--limit", "1000", "--json", prListFields)
	if err != nil {
		return PullRequestsResult{
			Repo:  repo,
			PRs:   []PullRequestListItem{},
			State: classifyGHError("list pull requests", IntegrationListingFailed, err, output),
		}, nil
	}

	prs, err := parsePullRequestList(output)
	if err != nil {
		return PullRequestsResult{}, err
	}

	return PullRequestsResult{
		Repo: repo,
		PRs:  prs,
		State: IntegrationState{
			Status:  IntegrationOK,
			Message: "GitHub integration is ready.",
		},
	}, nil
}

func (s *Service) ReadPullRequestMetadata(ctx context.Context, number int) (PullRequestDetailMetadata, error) {
	if number <= 0 {
		return PullRequestDetailMetadata{}, fmt.Errorf("pull request number is required")
	}

	repo, state := s.integrationState(ctx)
	if state.Status != IntegrationOK {
		return PullRequestDetailMetadata{}, &IntegrationError{State: state}
	}

	output, err := s.runGH(ctx, "pr", "view", strconv.Itoa(number), "--json", prDetailFields)
	if err != nil {
		state := classifyGHError("load pull request", IntegrationUnknown, err, output)
		return PullRequestDetailMetadata{}, &IntegrationError{State: state, Err: err}
	}

	metadata, err := parsePullRequestDetail(output, repo)
	if err != nil {
		return PullRequestDetailMetadata{}, err
	}

	return metadata, nil
}

func (s *Service) ApprovePullRequest(ctx context.Context, number int, body string) error {
	if number <= 0 {
		return fmt.Errorf("pull request number is required")
	}

	args := []string{"pr", "review", strconv.Itoa(number), "--approve"}
	if strings.TrimSpace(body) != "" {
		args = append(args, "--body", body)
	}

	output, err := s.runGH(ctx, args...)
	if err != nil {
		state := classifyGHError("approve pull request", IntegrationPermissionDenied, err, output)
		return &IntegrationError{State: state, Err: err}
	}

	return nil
}

func (s *Service) MergePullRequest(ctx context.Context, number int, method string) error {
	if number <= 0 {
		return fmt.Errorf("pull request number is required")
	}

	normalizedMethod := normalizeMergeMethod(method)
	if normalizedMethod == "" {
		metadata, err := s.ReadPullRequestMetadata(ctx, number)
		if err != nil {
			return err
		}
		normalizedMethod = metadata.Merge.DefaultMethod
	}
	if normalizedMethod == "" {
		return &IntegrationError{
			State: IntegrationState{
				Status:  IntegrationMergeBlocked,
				Message: "This repository does not expose an allowed merge method.",
			},
		}
	}

	output, err := s.runGH(ctx, "pr", "merge", strconv.Itoa(number), "--"+normalizedMethod)
	if err != nil {
		state := classifyGHError("merge pull request", IntegrationMergeBlocked, err, output)
		return &IntegrationError{State: state, Err: err}
	}

	return nil
}

func (s *Service) integrationState(ctx context.Context) (Repository, IntegrationState) {
	if _, err := exec.LookPath("gh"); err != nil {
		return Repository{}, IntegrationState{
			Status:  IntegrationGHMissing,
			Message: "GitHub CLI is not installed.",
			Action:  "Install the gh CLI and authenticate it with GitHub.",
		}
	}

	if output, err := s.runGH(ctx, "auth", "status", "--hostname", "github.com"); err != nil {
		return Repository{}, classifyGHError("check GitHub authentication", IntegrationGHUnauthed, err, output)
	}

	repo, err := s.readRepository(ctx)
	if err != nil {
		var integrationErr *IntegrationError
		if errors.As(err, &integrationErr) {
			return Repository{}, integrationErr.State
		}

		return Repository{}, IntegrationState{
			Status:  IntegrationRepoUnresolved,
			Message: "This Git repository could not be mapped to a GitHub repository.",
			Action:  "Check that a GitHub remote is configured for this repository.",
		}
	}

	return repo, IntegrationState{
		Status:  IntegrationOK,
		Message: "GitHub integration is ready.",
	}
}

func (s *Service) readRepository(ctx context.Context) (Repository, error) {
	output, err := s.runGH(ctx, "repo", "view", "--json", repoFields)
	if err != nil {
		state := classifyGHError("resolve GitHub repository", IntegrationRepoUnresolved, err, output)
		return Repository{}, &IntegrationError{State: state, Err: err}
	}

	repo, err := parseRepository(output)
	if err != nil {
		return Repository{}, err
	}
	if repo.Owner == "" || repo.Name == "" {
		return Repository{}, &IntegrationError{
			State: IntegrationState{
				Status:  IntegrationRepoUnresolved,
				Message: "This Git repository could not be mapped to a GitHub repository.",
				Action:  "Check that a GitHub remote is configured for this repository.",
			},
		}
	}

	return repo, nil
}

func (s *Service) runGH(ctx context.Context, args ...string) ([]byte, error) {
	timeout := s.timeout
	if timeout <= 0 {
		timeout = ghCommandTimeout
	}

	commandCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	cmd := exec.CommandContext(commandCtx, "gh", args...)
	cmd.Dir = s.repoRoot
	output, err := cmd.CombinedOutput()
	if commandCtx.Err() != nil {
		return output, fmt.Errorf("gh %s timed out: %w", strings.Join(args, " "), commandCtx.Err())
	}

	return output, err
}
