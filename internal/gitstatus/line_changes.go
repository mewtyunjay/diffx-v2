package gitstatus

import (
	"context"
	"fmt"
	"strconv"
	"strings"
)

type LineChanges struct {
	Additions int `json:"additions"`
	Deletions int `json:"deletions"`
}

func (s *Service) readLineChanges(ctx context.Context, revisions ...string) (map[string]LineChanges, error) {
	args := append([]string{"diff", "--numstat", "-z", "-M", "--no-ext-diff", "--no-textconv"}, revisions...)
	output, err := s.runGitOutput(ctx, append(args, "--")...)
	if err != nil {
		return nil, fmt.Errorf("git diff --numstat: %w", err)
	}
	return parseLineChanges(string(output))
}

func parseLineChanges(output string) (map[string]LineChanges, error) {
	if output != "" && !strings.HasSuffix(output, "\x00") {
		return nil, fmt.Errorf("unterminated numstat record")
	}
	tokens := strings.Split(output, "\x00")
	changes := make(map[string]LineChanges)
	for index := 0; index < len(tokens)-1; index++ {
		token := tokens[index]
		fields := strings.SplitN(token, "\t", 3)
		if len(fields) != 3 {
			return nil, fmt.Errorf("invalid numstat record %q", token)
		}
		path := fields[2]
		if path == "" {
			if index+2 >= len(tokens)-1 || tokens[index+1] == "" || tokens[index+2] == "" {
				return nil, fmt.Errorf("missing rename paths for numstat record %q", token)
			}
			path = tokens[index+2]
			index += 2
		}
		if fields[0] == "-" && fields[1] == "-" {
			continue
		}
		additions, addErr := strconv.Atoi(fields[0])
		deletions, deleteErr := strconv.Atoi(fields[1])
		if addErr != nil || deleteErr != nil || additions < 0 || deletions < 0 {
			return nil, fmt.Errorf("invalid line counts for %q", path)
		}
		changes[path] = LineChanges{Additions: additions, Deletions: deletions}
	}
	return changes, nil
}

func countTextLines(contents string) int {
	lines := strings.Count(contents, "\n")
	if contents != "" && !strings.HasSuffix(contents, "\n") {
		lines++
	}
	return lines
}
