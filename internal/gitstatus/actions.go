package gitstatus

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"os/exec"
	"strings"
)

var (
	ErrDetachedHead       = errors.New("current HEAD is detached")
	ErrEmptyCommitMessage = errors.New("commit message is required")
	ErrNoStagedChanges    = errors.New("no staged changes to commit")
	ErrPathOutsideScope   = errors.New("path is outside the current workspace scope")
)

type ScopedCommitBlockedError struct {
	HiddenStagedFileCount int
}

func (err *ScopedCommitBlockedError) Error() string {
	if err.HiddenStagedFileCount == 1 {
		return "1 staged file exists outside the current workspace scope"
	}

	return fmt.Sprintf("%d staged files exist outside the current workspace scope", err.HiddenStagedFileCount)
}

func (s *Service) StageFile(ctx context.Context, path string, previousPath string) error {
	if err := s.ensureScopedDiffPath(path, previousPath); err != nil {
		return err
	}

	args := []string{"add", "-A", "--", path}
	if previousPath != "" && previousPath != path {
		args = append(args, previousPath)
	}

	_, err := s.runGitCombined(ctx, "", args...)
	return err
}

func (s *Service) UnstageFile(ctx context.Context, path string, previousPath string) error {
	if err := s.ensureScopedDiffPath(path, previousPath); err != nil {
		return err
	}

	args := []string{"restore", "--staged", "--", path}
	if previousPath != "" && previousPath != path {
		args = append(args, previousPath)
	}

	_, err := s.runGitCombined(ctx, "", args...)
	return err
}

func (s *Service) CommitStaged(ctx context.Context, message string) (string, error) {
	trimmedMessage := strings.TrimSpace(message)
	if trimmedMessage == "" {
		return "", ErrEmptyCommitMessage
	}

	statusFiles, err := s.listStatusFiles(ctx)
	if err != nil {
		return "", err
	}

	hasStagedChanges := false
	hiddenStagedChanges := 0
	for _, file := range statusFiles {
		if !file.HasStagedChanges {
			continue
		}

		hasStagedChanges = true
		if !s.AllowsDiff(file.Path, file.PreviousPath) {
			hiddenStagedChanges++
		}
	}

	if hiddenStagedChanges > 0 {
		return "", &ScopedCommitBlockedError{HiddenStagedFileCount: hiddenStagedChanges}
	}
	if !hasStagedChanges {
		return "", ErrNoStagedChanges
	}

	if _, err := s.runGitCombined(ctx, trimmedMessage+"\n", "commit", "-F", "-"); err != nil {
		return "", err
	}

	return s.HeadCommit(ctx)
}

func (s *Service) PushCurrentBranch(ctx context.Context) (string, error) {
	currentBranch, err := s.CurrentBranch(ctx)
	if err != nil {
		return "", err
	}

	upstreamRef, err := s.CurrentUpstreamRef(ctx)
	if err != nil {
		return "", err
	}

	if upstreamRef != "" {
		_, err := s.runGitCombined(ctx, "", "push")
		return upstreamRef, err
	}

	remoteRef := fmt.Sprintf("origin/%s", currentBranch)
	_, err = s.runGitCombined(ctx, "", "push", "-u", "origin", currentBranch)
	if err != nil {
		return "", err
	}

	return remoteRef, nil
}

func (s *Service) CurrentBranch(ctx context.Context) (string, error) {
	cmd := exec.CommandContext(ctx, "git", "-C", s.repoRoot, "symbolic-ref", "--quiet", "--short", "HEAD")
	output, err := cmd.Output()
	if err != nil {
		return "", ErrDetachedHead
	}

	return strings.TrimSpace(string(output)), nil
}

func (s *Service) CurrentUpstreamRef(ctx context.Context) (string, error) {
	cmd := exec.CommandContext(ctx, "git", "-C", s.repoRoot, "rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}")
	output, err := cmd.Output()
	if err == nil {
		return strings.TrimSpace(string(output)), nil
	}

	var exitErr *exec.ExitError
	if errors.As(err, &exitErr) {
		return "", nil
	}

	return "", fmt.Errorf("resolve upstream ref: %w", err)
}

func (s *Service) ensureScopedDiffPath(path string, previousPath string) error {
	if path == "" {
		return fmt.Errorf("path is required")
	}
	if !s.AllowsDiff(path, previousPath) {
		return ErrPathOutsideScope
	}

	return nil
}

func (s *Service) runGitCombined(ctx context.Context, stdin string, args ...string) (string, error) {
	commandArgs := append([]string{"-C", s.repoRoot}, args...)
	cmd := exec.CommandContext(ctx, "git", commandArgs...)
	if stdin != "" {
		cmd.Stdin = strings.NewReader(stdin)
	}

	output, err := cmd.CombinedOutput()
	if err != nil {
		return "", formatGitCombinedError(args, output, err)
	}

	return strings.TrimSpace(string(output)), nil
}

func formatGitCombinedError(args []string, output []byte, err error) error {
	commandName := "git"
	if len(args) > 0 {
		commandName = "git " + strings.Join(args, " ")
	}

	message := strings.TrimSpace(string(bytes.TrimSpace(output)))
	if message == "" {
		return fmt.Errorf("%s: %w", commandName, err)
	}

	return fmt.Errorf("%s: %s", commandName, message)
}
