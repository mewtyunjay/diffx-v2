package gitstatus

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strings"
)

var ErrHunkPatchDoesNotApply = errors.New("hunk patch no longer applies")

type HunkAction struct {
	Path         string
	PreviousPath string
	Status       ChangedFileStatus
	HunkIndex    int
	HunkPatch    string
}

func (s *Service) StageHunk(ctx context.Context, action HunkAction) error {
	patch, err := s.prepareHunkPatch(action)
	if err != nil {
		return err
	}

	if s.canApplyHunkPatch(ctx, patch, "--cached", "--check") {
		return s.applyHunkPatch(ctx, patch, "--cached")
	}

	if s.canApplyHunkPatch(ctx, patch, "--cached", "--reverse", "--check") {
		return nil
	}

	return ErrHunkPatchDoesNotApply
}

func (s *Service) RejectHunk(ctx context.Context, action HunkAction) error {
	patch, err := s.prepareHunkPatch(action)
	if err != nil {
		return err
	}

	canReverseIndex := s.canApplyHunkPatch(ctx, patch, "--cached", "--reverse", "--check")
	canReverseWorktree := s.canApplyHunkPatch(ctx, patch, "--reverse", "--check")
	if !canReverseIndex && !canReverseWorktree {
		return ErrHunkPatchDoesNotApply
	}

	if canReverseIndex {
		if err := s.applyHunkPatch(ctx, patch, "--cached", "--reverse"); err != nil {
			return err
		}
	}

	if canReverseWorktree {
		if err := s.applyHunkPatch(ctx, patch, "--reverse"); err != nil {
			return err
		}
	}

	if action.Status == StatusAdded {
		if err := s.removeEmptyUntrackedFile(ctx, action.Path); err != nil {
			return err
		}
	}

	return nil
}

func (s *Service) prepareHunkPatch(action HunkAction) (string, error) {
	if err := s.ensureScopedDiffPath(action.Path, action.PreviousPath); err != nil {
		return "", err
	}
	if !action.Status.IsValid() {
		return "", fmt.Errorf("invalid status %q", action.Status)
	}
	if action.Status == StatusConflicted {
		return "", fmt.Errorf("hunk actions are not available for conflicted files")
	}
	if action.HunkIndex < 0 {
		return "", fmt.Errorf("hunk index must be non-negative")
	}

	hunkPatch := strings.ReplaceAll(action.HunkPatch, "\r\n", "\n")
	hunkPatch = strings.ReplaceAll(hunkPatch, "\r", "\n")
	hunkPatch = strings.Trim(hunkPatch, "\n")
	if hunkPatch == "" {
		return "", fmt.Errorf("hunk patch is required")
	}
	if !strings.HasPrefix(hunkPatch, "@@ ") {
		return "", fmt.Errorf("hunk patch must start with a hunk header")
	}

	oldPath := action.Path
	if action.PreviousPath != "" {
		oldPath = action.PreviousPath
	}

	oldHeader := "a/" + oldPath
	newHeader := "b/" + action.Path
	switch action.Status {
	case StatusAdded:
		oldHeader = "/dev/null"
	case StatusDeleted:
		newHeader = "/dev/null"
	}

	lines := []string{fmt.Sprintf("diff --git a/%s b/%s", oldPath, action.Path)}
	switch action.Status {
	case StatusAdded:
		lines = append(lines, "new file mode 100644")
	case StatusDeleted:
		lines = append(lines, "deleted file mode 100644")
	}
	lines = append(lines, "--- "+oldHeader, "+++ "+newHeader, hunkPatch, "")

	return strings.Join(lines, "\n"), nil
}

func (s *Service) canApplyHunkPatch(ctx context.Context, patch string, args ...string) bool {
	return s.applyHunkPatch(ctx, patch, args...) == nil
}

func (s *Service) applyHunkPatch(ctx context.Context, patch string, args ...string) error {
	gitArgs := append([]string{"apply", "--whitespace=nowarn", "--unidiff-zero"}, args...)
	_, err := s.runGitCombined(ctx, patch, gitArgs...)
	return err
}

func (s *Service) removeEmptyUntrackedFile(ctx context.Context, path string) error {
	tracked, err := s.isTrackedPath(ctx, path)
	if err != nil {
		return err
	}
	if tracked {
		return nil
	}

	absPath, err := ResolveRepoPath(s.repoRoot, path)
	if err != nil {
		return err
	}

	info, err := os.Stat(absPath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}

		return err
	}
	if info.IsDir() || info.Size() != 0 {
		return nil
	}

	return os.Remove(absPath)
}
