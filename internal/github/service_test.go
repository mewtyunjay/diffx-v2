package github

import (
	"errors"
	"strings"
	"testing"
)

func TestParsePullRequestListNormalizesSidebarMetadata(t *testing.T) {
	t.Parallel()

	prs, err := parsePullRequestList([]byte(`[
		{
			"number": 12,
			"title": "Ship PR tab",
			"url": "https://github.com/acme/diffx/pull/12",
			"author": {"login": "alex"},
			"isDraft": true,
			"baseRefName": "main",
			"headRefName": "feature/pr-tab",
			"headRepositoryOwner": {"login": "fork-owner"},
			"headRepository": {"name": "diffx-fork", "owner": {"login": "fork-owner"}},
			"updatedAt": "2026-06-04T12:00:00Z",
			"createdAt": "2026-06-03T12:00:00Z",
			"labels": [{"name": "ui"}, {"name": "backend"}],
			"reviewDecision": "REVIEW_REQUIRED",
			"comments": [{}, {}],
			"commits": [{}, {}, {}],
			"changedFiles": 7,
			"statusCheckRollup": [
				{"conclusion": "SUCCESS"},
				{"state": "PENDING"}
			]
		}
	]`))
	if err != nil {
		t.Fatalf("parsePullRequestList returned error: %v", err)
	}

	if len(prs) != 1 {
		t.Fatalf("expected one PR, got %#v", prs)
	}

	pr := prs[0]
	if pr.Number != 12 || pr.Title != "Ship PR tab" || !pr.IsDraft {
		t.Fatalf("unexpected PR list item: %#v", pr)
	}
	if pr.Author != "alex" || pr.HeadRepositoryOwner != "fork-owner" || pr.HeadRepositoryName != "diffx-fork" {
		t.Fatalf("expected author and fork metadata, got %#v", pr)
	}
	if pr.CheckConclusion != "pending" || pr.CommentsCount != 2 || pr.CommitsCount != 3 || pr.ChangedFilesCount != 7 {
		t.Fatalf("expected counts and pending checks, got %#v", pr)
	}
	if len(pr.Labels) != 2 || pr.Labels[0] != "ui" || pr.Labels[1] != "backend" {
		t.Fatalf("expected labels, got %#v", pr.Labels)
	}
}

func TestParsePullRequestDetailBuildsMergeAndReviewState(t *testing.T) {
	t.Parallel()

	repo := Repository{
		Owner: "acme",
		Name:  "diffx",
		URL:   "https://github.com/acme/diffx",
		MergeCapabilities: RepositoryMergeCapabilities{
			MergeCommitAllowed:       true,
			SquashMergeAllowed:       true,
			RebaseMergeAllowed:       true,
			ViewerDefaultMergeMethod: "squash",
		},
	}

	detail, err := parsePullRequestDetail([]byte(`{
		"number": 42,
		"title": "Add GitHub PR review",
		"url": "https://github.com/acme/diffx/pull/42",
		"author": {"login": "reviewer"},
		"body": "Review this locally.",
		"state": "OPEN",
		"isDraft": false,
		"baseRefName": "main",
		"baseRefOid": "1111111111111111111111111111111111111111",
		"headRefName": "feature",
		"headRefOid": "2222222222222222222222222222222222222222",
		"headRepositoryOwner": {"login": "acme"},
		"headRepository": {"name": "diffx", "owner": {"login": "acme"}},
		"createdAt": "2026-06-01T10:00:00Z",
		"updatedAt": "2026-06-04T10:00:00Z",
		"labels": [{"name": "feature"}],
		"reviewDecision": "APPROVED",
		"reviewRequests": [],
		"latestReviews": [
			{"author": {"login": "sam"}, "state": "APPROVED", "submittedAt": "2026-06-04T11:00:00Z", "body": "LGTM"}
		],
		"comments": [{}],
		"commits": [
			{
				"oid": "2222222222222222222222222222222222222222",
				"messageHeadline": "add pr tab",
				"authoredDate": "2026-06-04T09:00:00Z",
				"author": {"name": "Jay"}
			}
		],
		"changedFiles": 5,
		"mergeable": "MERGEABLE",
		"mergeStateStatus": "CLEAN",
		"statusCheckRollup": [{"conclusion": "SUCCESS"}]
	}`), repo)
	if err != nil {
		t.Fatalf("parsePullRequestDetail returned error: %v", err)
	}

	if detail.PR.Number != 42 || detail.PR.Author != "reviewer" || detail.PR.ChangedFilesCount != 5 {
		t.Fatalf("unexpected PR metadata: %#v", detail.PR)
	}
	if detail.Base.RefName != "main" || detail.Base.SHA != "1111111111111111111111111111111111111111" {
		t.Fatalf("unexpected base ref: %#v", detail.Base)
	}
	if detail.Head.RefName != "feature" || detail.Head.SHA != "2222222222222222222222222222222222222222" {
		t.Fatalf("unexpected head ref: %#v", detail.Head)
	}
	if !detail.Merge.CanMerge || detail.Merge.DefaultMethod != "squash" {
		t.Fatalf("expected merge to be allowed with squash default, got %#v", detail.Merge)
	}
	if detail.Checks.Conclusion != "success" || detail.Reviews.Decision != "APPROVED" {
		t.Fatalf("expected success checks and approved review, got checks=%#v reviews=%#v", detail.Checks, detail.Reviews)
	}
	if len(detail.Commits) != 1 || detail.Commits[0].ShortHash != "222222222222" {
		t.Fatalf("expected normalized commit metadata, got %#v", detail.Commits)
	}
}

func TestDefaultMergeMethodFallsBackToAllowedMethods(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		caps RepositoryMergeCapabilities
		want string
	}{
		{
			name: "viewer default allowed",
			caps: RepositoryMergeCapabilities{
				MergeCommitAllowed:       true,
				SquashMergeAllowed:       true,
				ViewerDefaultMergeMethod: "SQUASH",
			},
			want: "squash",
		},
		{
			name: "merge first",
			caps: RepositoryMergeCapabilities{
				MergeCommitAllowed: true,
				SquashMergeAllowed: true,
			},
			want: "merge",
		},
		{
			name: "squash fallback",
			caps: RepositoryMergeCapabilities{
				SquashMergeAllowed: true,
				RebaseMergeAllowed: true,
			},
			want: "squash",
		},
		{
			name: "rebase fallback",
			caps: RepositoryMergeCapabilities{
				RebaseMergeAllowed: true,
			},
			want: "rebase",
		},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			if got := defaultMergeMethod(tt.caps); got != tt.want {
				t.Fatalf("defaultMergeMethod() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestMergeBlockedReasonClassifiesCommonBlockers(t *testing.T) {
	t.Parallel()

	allowed := []string{"merge"}
	tests := []struct {
		name    string
		pr      prJSON
		checks  PullRequestChecksSummary
		reviews PullRequestReviewsSummary
		want    string
	}{
		{
			name: "draft",
			pr:   prJSON{IsDraft: true},
			want: "Draft pull requests cannot be merged.",
		},
		{
			name: "conflicting",
			pr:   prJSON{Mergeable: "CONFLICTING"},
			want: "This pull request has merge conflicts.",
		},
		{
			name:    "missing required review",
			pr:      prJSON{Mergeable: "MERGEABLE", MergeStateStatus: "CLEAN"},
			reviews: PullRequestReviewsSummary{Decision: "REVIEW_REQUIRED"},
			want:    "Required reviews are missing.",
		},
		{
			name:   "failing checks",
			pr:     prJSON{Mergeable: "MERGEABLE", MergeStateStatus: "CLEAN"},
			checks: PullRequestChecksSummary{Conclusion: "failure"},
			want:   "Required checks are failing.",
		},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			if got := mergeBlockedReason(tt.pr, tt.checks, tt.reviews, allowed); got != tt.want {
				t.Fatalf("mergeBlockedReason() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestClassifyGHErrorDistinguishesAuthPermissionAndRepoErrors(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name          string
		defaultStatus IntegrationStatus
		output        string
		want          IntegrationStatus
	}{
		{
			name:          "unauthenticated",
			defaultStatus: IntegrationListingFailed,
			output:        "You are not logged into any GitHub hosts. Run gh auth login.",
			want:          IntegrationGHUnauthed,
		},
		{
			name:          "permission denied",
			defaultStatus: IntegrationMergeBlocked,
			output:        "GraphQL: Resource not accessible by integration",
			want:          IntegrationPermissionDenied,
		},
		{
			name:          "repo unresolved",
			defaultStatus: IntegrationListingFailed,
			output:        "fatal: not a git repository",
			want:          IntegrationRepoUnresolved,
		},
		{
			name:          "blocked merge",
			defaultStatus: IntegrationMergeBlocked,
			output:        "Pull request is in draft state and cannot be merged",
			want:          IntegrationMergeBlocked,
		},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			state := classifyGHError("test", tt.defaultStatus, errors.New("exit 1"), []byte(tt.output))
			if state.Status != tt.want {
				t.Fatalf("state status = %q, want %q; state=%#v", state.Status, tt.want, state)
			}
			if strings.TrimSpace(state.Message) == "" {
				t.Fatalf("expected message, got %#v", state)
			}
		})
	}
}
