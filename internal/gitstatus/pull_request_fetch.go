package gitstatus

import (
	"context"
	"fmt"
	"os/exec"
	"strconv"
	"strings"
	"time"
)

const gitFetchTimeout = 30 * time.Second

type fetchRefspec struct {
	remote  string
	refspec string
}

func (s *Service) fetchPullRequestRefs(
	ctx context.Context,
	refs PullRequestRefs,
	baseRef string,
	headRef string,
) error {
	fetchCtx, cancel := context.WithTimeout(ctx, gitFetchTimeout)
	defer cancel()

	if err := s.fetchFirstRefspec(fetchCtx, baseFetchRefspecs(refs, baseRef)); err != nil {
		return fmt.Errorf("fetch PR base ref: %w", err)
	}
	if err := s.fetchFirstRefspec(fetchCtx, headFetchRefspecs(refs, headRef)); err != nil {
		return fmt.Errorf("fetch PR head ref: %w", err)
	}

	return nil
}

func (s *Service) fetchFirstRefspec(ctx context.Context, refspecs []fetchRefspec) error {
	var lastErr error
	for _, candidate := range refspecs {
		if strings.TrimSpace(candidate.remote) == "" || strings.TrimSpace(candidate.refspec) == "" {
			continue
		}

		if err := s.runGitFetch(ctx, candidate.remote, candidate.refspec); err == nil {
			return nil
		} else {
			lastErr = err
		}
	}

	if lastErr == nil {
		return fmt.Errorf("no fetch refspecs were available")
	}

	return lastErr
}

func (s *Service) runGitFetch(ctx context.Context, remote string, refspec string) error {
	cmd := exec.CommandContext(ctx, "git", "-C", s.repoRoot, "fetch", "--no-tags", remote, refspec)
	output, err := cmd.CombinedOutput()
	if ctx.Err() != nil {
		return fmt.Errorf("git fetch timed out: %w", ctx.Err())
	}
	if err != nil {
		message := strings.TrimSpace(string(output))
		if len(message) > 240 {
			message = strings.TrimSpace(message[:240]) + "..."
		}
		if message == "" {
			message = err.Error()
		}
		return fmt.Errorf("%s", message)
	}

	return nil
}

func baseFetchRefspecs(refs PullRequestRefs, baseRef string) []fetchRefspec {
	refspecs := []fetchRefspec{}
	if refs.BaseSHA != "" {
		refspecs = append(refspecs, fetchRefspec{remote: "origin", refspec: refs.BaseSHA + ":" + baseRef})
	}
	if refs.BaseRefName != "" {
		refspecs = append(refspecs, fetchRefspec{remote: "origin", refspec: "refs/heads/" + refs.BaseRefName + ":" + baseRef})
		refspecs = append(refspecs, fetchRefspec{remote: "origin", refspec: refs.BaseRefName + ":" + baseRef})
	}

	return refspecs
}

func headFetchRefspecs(refs PullRequestRefs, headRef string) []fetchRefspec {
	refspecs := []fetchRefspec{
		{remote: "origin", refspec: "pull/" + strconv.Itoa(refs.Number) + "/head:" + headRef},
	}
	if refs.HeadSHA != "" {
		refspecs = append(refspecs, fetchRefspec{remote: "origin", refspec: refs.HeadSHA + ":" + headRef})
	}

	if refs.HeadRepositoryOwner != "" && refs.HeadRepositoryName != "" && refs.HeadRefName != "" {
		remoteURL := fmt.Sprintf(
			"https://github.com/%s/%s.git",
			refs.HeadRepositoryOwner,
			refs.HeadRepositoryName,
		)
		refspecs = append(refspecs, fetchRefspec{remote: remoteURL, refspec: refs.HeadRefName + ":" + headRef})
		refspecs = append(refspecs, fetchRefspec{remote: remoteURL, refspec: "refs/heads/" + refs.HeadRefName + ":" + headRef})
	}
	if refs.HeadRefName != "" {
		refspecs = append(refspecs, fetchRefspec{remote: "origin", refspec: "refs/heads/" + refs.HeadRefName + ":" + headRef})
		refspecs = append(refspecs, fetchRefspec{remote: "origin", refspec: refs.HeadRefName + ":" + headRef})
	}

	return refspecs
}
