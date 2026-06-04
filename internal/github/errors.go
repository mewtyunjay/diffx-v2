package github

import (
	"bytes"
	"fmt"
	"strings"
)

func classifyGHError(
	operation string,
	defaultStatus IntegrationStatus,
	err error,
	output []byte,
) IntegrationState {
	message := sanitizeCLIMessage(output)
	lowerMessage := strings.ToLower(message)
	status := defaultStatus
	action := ""

	switch {
	case strings.Contains(lowerMessage, "not logged into") ||
		strings.Contains(lowerMessage, "authentication required") ||
		strings.Contains(lowerMessage, "gh auth login") ||
		strings.Contains(lowerMessage, "bad credentials"):
		status = IntegrationGHUnauthed
		message = "GitHub CLI is installed but not authenticated."
		action = "Run gh auth login, then refresh DiffX."
	case strings.Contains(lowerMessage, "permission") ||
		strings.Contains(lowerMessage, "resource not accessible") ||
		strings.Contains(lowerMessage, "http 403"):
		status = IntegrationPermissionDenied
		message = "Your GitHub account does not have permission for this pull request action."
	case strings.Contains(lowerMessage, "could not resolve to a repository") ||
		strings.Contains(lowerMessage, "not a git repository") ||
		strings.Contains(lowerMessage, "no git remotes"):
		status = IntegrationRepoUnresolved
		message = "This Git repository could not be mapped to a GitHub repository."
		action = "Check that a GitHub remote is configured for this repository."
	case strings.Contains(lowerMessage, "not found") || strings.Contains(lowerMessage, "http 404"):
		status = IntegrationNotFound
		message = "GitHub could not find the requested pull request or repository."
	case strings.Contains(lowerMessage, "merge") ||
		strings.Contains(lowerMessage, "branch protection") ||
		strings.Contains(lowerMessage, "required") ||
		strings.Contains(lowerMessage, "draft"):
		if defaultStatus == IntegrationMergeBlocked {
			status = IntegrationMergeBlocked
			message = "GitHub blocked this merge. Check the pull request requirements and branch protection rules."
		}
	}

	if message == "" {
		if err != nil {
			message = fmt.Sprintf("Unable to %s.", operation)
		} else {
			message = fmt.Sprintf("Unable to %s.", operation)
		}
	}

	return IntegrationState{
		Status:  status,
		Message: message,
		Action:  action,
	}
}

func sanitizeCLIMessage(output []byte) string {
	output = bytes.TrimSpace(output)
	if len(output) == 0 {
		return ""
	}

	lines := bytes.Split(output, []byte{'\n'})
	cleaned := make([]string, 0, len(lines))
	for _, line := range lines {
		line = bytes.TrimSpace(line)
		if len(line) == 0 {
			continue
		}
		text := string(line)
		if strings.HasPrefix(text, "X ") {
			text = strings.TrimSpace(strings.TrimPrefix(text, "X "))
		}
		cleaned = append(cleaned, text)
	}

	message := strings.Join(cleaned, " ")
	if len(message) > 240 {
		return strings.TrimSpace(message[:240]) + "..."
	}

	return message
}
