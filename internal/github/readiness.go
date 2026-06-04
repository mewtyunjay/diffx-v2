package github

import (
	"encoding/json"
	"strings"
)

func summarizeChecks(rawChecks []json.RawMessage) PullRequestChecksSummary {
	summary := PullRequestChecksSummary{
		Conclusion: "unknown",
		TotalCount: len(rawChecks),
	}

	if len(rawChecks) == 0 {
		return summary
	}

	for _, raw := range rawChecks {
		conclusion := normalizeCheckConclusion(raw)
		switch conclusion {
		case "success":
			summary.SuccessCount++
		case "failure":
			summary.FailureCount++
		case "pending":
			summary.PendingCount++
		case "skipped", "neutral":
			summary.SkippedCount++
		default:
			summary.PendingCount++
		}
	}

	switch {
	case summary.FailureCount > 0:
		summary.Conclusion = "failure"
	case summary.PendingCount > 0:
		summary.Conclusion = "pending"
	case summary.SuccessCount > 0:
		summary.Conclusion = "success"
	default:
		summary.Conclusion = "neutral"
	}

	return summary
}

func normalizeCheckConclusion(raw json.RawMessage) string {
	var fields map[string]any
	if err := json.Unmarshal(raw, &fields); err != nil {
		return "unknown"
	}

	for _, key := range []string{"conclusion", "state"} {
		if value, ok := fields[key].(string); ok {
			normalized := normalizeCheckValue(value)
			if normalized != "" {
				return normalized
			}
		}
	}

	if value, ok := fields["status"].(string); ok {
		normalized := strings.ToUpper(value)
		if normalized == "COMPLETED" {
			return "unknown"
		}
		return "pending"
	}

	return "unknown"
}

func normalizeCheckValue(value string) string {
	switch strings.ToUpper(strings.TrimSpace(value)) {
	case "SUCCESS", "EXPECTED", "PASSING":
		return "success"
	case "FAILURE", "ERROR", "FAILED", "TIMED_OUT", "CANCELLED", "ACTION_REQUIRED":
		return "failure"
	case "PENDING", "WAITING", "QUEUED", "IN_PROGRESS", "REQUESTED":
		return "pending"
	case "NEUTRAL":
		return "neutral"
	case "SKIPPED":
		return "skipped"
	default:
		return ""
	}
}

func summarizeReviews(
	decision string,
	requests []reviewRequestJSON,
	latestReviews []reviewJSON,
) PullRequestReviewsSummary {
	reviewers := make([]string, 0, len(requests))
	for _, request := range requests {
		name := strings.TrimSpace(request.Login)
		if name == "" {
			name = strings.TrimSpace(request.Name)
		}
		if name != "" {
			reviewers = append(reviewers, name)
		}
	}

	reviews := make([]PullRequestReview, 0, len(latestReviews))
	for _, review := range latestReviews {
		reviews = append(reviews, PullRequestReview{
			Author:      bestAccountName(review.Author),
			State:       review.State,
			SubmittedAt: review.SubmittedAt,
			Body:        review.Body,
		})
	}

	return PullRequestReviewsSummary{
		Decision:          decision,
		RequiredReviewers: reviewers,
		LatestReviews:     reviews,
	}
}

func buildMergeState(
	pr prJSON,
	capabilities RepositoryMergeCapabilities,
	checks PullRequestChecksSummary,
	reviews PullRequestReviewsSummary,
) PullRequestMergeState {
	allowedMethods := allowedMergeMethods(capabilities)
	defaultMethod := defaultMergeMethod(capabilities)
	blockedReason := mergeBlockedReason(pr, checks, reviews, allowedMethods)

	return PullRequestMergeState{
		Mergeable:      pr.Mergeable,
		StateStatus:    pr.MergeStateStatus,
		CanMerge:       blockedReason == "",
		BlockedReason:  blockedReason,
		AllowedMethods: allowedMethods,
		DefaultMethod:  defaultMethod,
	}
}

func mergeBlockedReason(
	pr prJSON,
	checks PullRequestChecksSummary,
	reviews PullRequestReviewsSummary,
	allowedMethods []string,
) string {
	if len(allowedMethods) == 0 {
		return "This repository does not allow merge, squash, or rebase merges."
	}
	if pr.IsDraft {
		return "Draft pull requests cannot be merged."
	}

	switch strings.ToUpper(pr.Mergeable) {
	case "CONFLICTING":
		return "This pull request has merge conflicts."
	case "UNKNOWN":
		return "GitHub has not finished computing mergeability."
	}

	switch strings.ToUpper(pr.MergeStateStatus) {
	case "DIRTY":
		return "This pull request has merge conflicts."
	case "BLOCKED":
		return "Branch protection is blocking this merge."
	case "BEHIND":
		return "This pull request must be updated before it can merge."
	}

	if reviews.Decision == "CHANGES_REQUESTED" {
		return "A reviewer has requested changes."
	}
	if reviews.Decision == "REVIEW_REQUIRED" {
		return "Required reviews are missing."
	}
	if checks.Conclusion == "failure" {
		return "Required checks are failing."
	}
	if checks.Conclusion == "pending" {
		return "Required checks are still pending."
	}

	return ""
}

func allowedMergeMethods(capabilities RepositoryMergeCapabilities) []string {
	methods := []string{}
	if capabilities.MergeCommitAllowed {
		methods = append(methods, "merge")
	}
	if capabilities.SquashMergeAllowed {
		methods = append(methods, "squash")
	}
	if capabilities.RebaseMergeAllowed {
		methods = append(methods, "rebase")
	}

	return methods
}

func defaultMergeMethod(capabilities RepositoryMergeCapabilities) string {
	allowed := map[string]bool{}
	for _, method := range allowedMergeMethods(capabilities) {
		allowed[method] = true
	}

	defaultMethod := normalizeMergeMethod(capabilities.ViewerDefaultMergeMethod)
	if allowed[defaultMethod] {
		return defaultMethod
	}

	for _, method := range []string{"merge", "squash", "rebase"} {
		if allowed[method] {
			return method
		}
	}

	return ""
}

func normalizeMergeMethod(method string) string {
	switch strings.ToLower(strings.TrimSpace(method)) {
	case "merge", "merge_commit", "merging":
		return "merge"
	case "squash", "squash_merge":
		return "squash"
	case "rebase", "rebase_merge":
		return "rebase"
	default:
		return ""
	}
}
