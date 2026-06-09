package github

import (
	"encoding/json"
	"fmt"
	"strings"
)

type repositoryJSON struct {
	Name                     string      `json:"name"`
	Owner                    accountJSON `json:"owner"`
	URL                      string      `json:"url"`
	MergeCommitAllowed       bool        `json:"mergeCommitAllowed"`
	SquashMergeAllowed       bool        `json:"squashMergeAllowed"`
	RebaseMergeAllowed       bool        `json:"rebaseMergeAllowed"`
	ViewerDefaultMergeMethod string      `json:"viewerDefaultMergeMethod"`
}

type prJSON struct {
	Number              int                 `json:"number"`
	Title               string              `json:"title"`
	URL                 string              `json:"url"`
	Author              accountJSON         `json:"author"`
	Body                string              `json:"body"`
	State               string              `json:"state"`
	IsDraft             bool                `json:"isDraft"`
	BaseRefName         string              `json:"baseRefName"`
	BaseRefOID          string              `json:"baseRefOid"`
	HeadRefName         string              `json:"headRefName"`
	HeadRefOID          string              `json:"headRefOid"`
	HeadRepositoryOwner accountJSON         `json:"headRepositoryOwner"`
	HeadRepository      repositoryLiteJSON  `json:"headRepository"`
	CreatedAt           string              `json:"createdAt"`
	UpdatedAt           string              `json:"updatedAt"`
	Labels              []labelJSON         `json:"labels"`
	ReviewDecision      string              `json:"reviewDecision"`
	ReviewRequests      []reviewRequestJSON `json:"reviewRequests"`
	LatestReviews       []reviewJSON        `json:"latestReviews"`
	Comments            []json.RawMessage   `json:"comments"`
	Commits             []commitJSON        `json:"commits"`
	ChangedFiles        int                 `json:"changedFiles"`
	Mergeable           string              `json:"mergeable"`
	MergeStateStatus    string              `json:"mergeStateStatus"`
	StatusCheckRollup   []json.RawMessage   `json:"statusCheckRollup"`
}

type accountJSON struct {
	Login string `json:"login"`
	Name  string `json:"name"`
}

type repositoryLiteJSON struct {
	Name  string      `json:"name"`
	Owner accountJSON `json:"owner"`
}

type labelJSON struct {
	Name string `json:"name"`
}

type reviewRequestJSON struct {
	Login string `json:"login"`
	Name  string `json:"name"`
}

type reviewJSON struct {
	Author      accountJSON `json:"author"`
	State       string      `json:"state"`
	SubmittedAt string      `json:"submittedAt"`
	Body        string      `json:"body"`
}

type commitJSON struct {
	OID             string             `json:"oid"`
	MessageHeadline string             `json:"messageHeadline"`
	AuthoredDate    string             `json:"authoredDate"`
	Author          commitAuthorJSON   `json:"author"`
	Authors         []commitAuthorJSON `json:"authors"`
}

type commitAuthorJSON struct {
	Name  string `json:"name"`
	Date  string `json:"date"`
	Email string `json:"email"`
	Login string `json:"login"`
}

func parseRepository(output []byte) (Repository, error) {
	var raw repositoryJSON
	if err := json.Unmarshal(output, &raw); err != nil {
		return Repository{}, fmt.Errorf("parse GitHub repository JSON: %w", err)
	}

	return Repository{
		Owner: raw.Owner.Login,
		Name:  raw.Name,
		URL:   raw.URL,
		MergeCapabilities: RepositoryMergeCapabilities{
			MergeCommitAllowed:       raw.MergeCommitAllowed,
			SquashMergeAllowed:       raw.SquashMergeAllowed,
			RebaseMergeAllowed:       raw.RebaseMergeAllowed,
			ViewerDefaultMergeMethod: normalizeMergeMethod(raw.ViewerDefaultMergeMethod),
		},
	}, nil
}

func parsePullRequestList(output []byte) ([]PullRequestListItem, error) {
	var raw []prJSON
	if err := json.Unmarshal(output, &raw); err != nil {
		return nil, fmt.Errorf("parse pull request list JSON: %w", err)
	}

	prs := make([]PullRequestListItem, 0, len(raw))
	for _, pr := range raw {
		checks := summarizeChecks(pr.StatusCheckRollup)
		prs = append(prs, PullRequestListItem{
			Number:              pr.Number,
			Title:               pr.Title,
			URL:                 pr.URL,
			Author:              bestAccountName(pr.Author),
			IsDraft:             pr.IsDraft,
			BaseRefName:         pr.BaseRefName,
			HeadRefName:         pr.HeadRefName,
			HeadRepositoryOwner: bestAccountName(pr.HeadRepositoryOwner),
			HeadRepositoryName:  pr.HeadRepository.Name,
			UpdatedAt:           pr.UpdatedAt,
			CreatedAt:           pr.CreatedAt,
			Labels:              labelNames(pr.Labels),
			ReviewDecision:      pr.ReviewDecision,
			CheckConclusion:     checks.Conclusion,
			CommentsCount:       len(pr.Comments),
			CommitsCount:        len(pr.Commits),
			ChangedFilesCount:   pr.ChangedFiles,
		})
	}

	return prs, nil
}

func parsePullRequestDetail(output []byte, repo Repository) (PullRequestDetailMetadata, error) {
	var pr prJSON
	if err := json.Unmarshal(output, &pr); err != nil {
		return PullRequestDetailMetadata{}, fmt.Errorf("parse pull request detail JSON: %w", err)
	}

	checks := summarizeChecks(pr.StatusCheckRollup)
	reviews := summarizeReviews(pr.ReviewDecision, pr.ReviewRequests, pr.LatestReviews)
	merge := buildMergeState(pr, repo.MergeCapabilities, checks, reviews)

	return PullRequestDetailMetadata{
		PR: PullRequestDetail{
			Number:            pr.Number,
			Title:             pr.Title,
			URL:               pr.URL,
			Author:            bestAccountName(pr.Author),
			Body:              pr.Body,
			State:             pr.State,
			IsDraft:           pr.IsDraft,
			CreatedAt:         pr.CreatedAt,
			UpdatedAt:         pr.UpdatedAt,
			Labels:            labelNames(pr.Labels),
			CommentsCount:     len(pr.Comments),
			CommitsCount:      len(pr.Commits),
			ChangedFilesCount: pr.ChangedFiles,
		},
		Repo: repo,
		Base: PullRequestRef{
			RefName:         pr.BaseRefName,
			SHA:             pr.BaseRefOID,
			RepositoryOwner: repo.Owner,
			RepositoryName:  repo.Name,
		},
		Head: PullRequestRef{
			RefName:         pr.HeadRefName,
			SHA:             pr.HeadRefOID,
			RepositoryOwner: bestAccountName(pr.HeadRepositoryOwner),
			RepositoryName:  pr.HeadRepository.Name,
		},
		Merge:   merge,
		Checks:  checks,
		Reviews: reviews,
		Commits: normalizeCommits(pr.Commits),
	}, nil
}

func normalizeCommits(rawCommits []commitJSON) []CommitItem {
	commits := make([]CommitItem, 0, len(rawCommits))
	for _, raw := range rawCommits {
		author := raw.Author
		if author.Name == "" && len(raw.Authors) > 0 {
			author = raw.Authors[0]
		}
		authorDate := raw.AuthoredDate
		if authorDate == "" {
			authorDate = author.Date
		}

		commits = append(commits, CommitItem{
			Hash:       raw.OID,
			ShortHash:  shortHash(raw.OID),
			Subject:    raw.MessageHeadline,
			AuthorName: author.Name,
			AuthorDate: authorDate,
		})
	}

	return commits
}

func labelNames(labels []labelJSON) []string {
	names := make([]string, 0, len(labels))
	for _, label := range labels {
		name := strings.TrimSpace(label.Name)
		if name != "" {
			names = append(names, name)
		}
	}

	return names
}

func bestAccountName(account accountJSON) string {
	if strings.TrimSpace(account.Login) != "" {
		return account.Login
	}

	return strings.TrimSpace(account.Name)
}

func shortHash(hash string) string {
	if len(hash) > 12 {
		return hash[:12]
	}

	return hash
}
