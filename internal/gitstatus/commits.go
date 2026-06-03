package gitstatus

import (
	"bytes"
	"context"
	"fmt"
	"strconv"
)

const (
	defaultCommitLimit = 100
	maxCommitLimit     = 500
	commitFieldSep     = byte(0x1f)
	commitRecordSep    = byte(0x1e)
)

func (s *Service) ListCommits(ctx context.Context, limit int) (CommitsResult, error) {
	currentRef, err := s.CurrentRef(ctx)
	if err != nil {
		return CommitsResult{}, err
	}

	commitLimit := normalizeCommitLimit(limit)
	output, err := s.runGitOutput(
		ctx,
		"log",
		"HEAD",
		"--max-count="+strconv.Itoa(commitLimit),
		"--format=%H%x1f%h%x1f%s%x1f%an%x1f%aI%x1e",
	)
	if err != nil {
		return CommitsResult{}, fmt.Errorf("git log HEAD: %w", err)
	}

	commits, err := parseCommitLog(output)
	if err != nil {
		return CommitsResult{}, err
	}

	return CommitsResult{
		CurrentRef: currentRef,
		Commits:    commits,
	}, nil
}

func normalizeCommitLimit(limit int) int {
	if limit <= 0 {
		return defaultCommitLimit
	}

	if limit > maxCommitLimit {
		return maxCommitLimit
	}

	return limit
}

func parseCommitLog(output []byte) ([]CommitItem, error) {
	records := bytes.Split(output, []byte{commitRecordSep})
	commits := make([]CommitItem, 0, len(records))

	for _, record := range records {
		record = bytes.Trim(record, "\n\r")
		if len(record) == 0 {
			continue
		}

		fields := bytes.Split(record, []byte{commitFieldSep})
		if len(fields) != 5 {
			return nil, fmt.Errorf("invalid commit log record")
		}

		commits = append(commits, CommitItem{
			Hash:       string(fields[0]),
			ShortHash:  string(fields[1]),
			Subject:    string(fields[2]),
			AuthorName: string(fields[3]),
			AuthorDate: string(fields[4]),
		})
	}

	return commits, nil
}
