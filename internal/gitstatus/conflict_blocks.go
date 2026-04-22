package gitstatus

import (
	"os"
	"strings"
)

func readConflictBlocksRemaining(repoRoot, relPath string) (int, error) {
	absPath, err := ResolveRepoPath(repoRoot, relPath)
	if err != nil {
		return 0, err
	}

	contents, err := os.ReadFile(absPath)
	if err != nil {
		if os.IsNotExist(err) {
			return 0, nil
		}

		return 0, err
	}

	return countConflictBlocks(string(contents)), nil
}

func countConflictBlocks(contents string) int {
	if contents == "" {
		return 0
	}

	count := 0
	for _, line := range strings.Split(contents, "\n") {
		if strings.HasPrefix(line, "<<<<<<<") {
			count++
		}
	}

	return count
}
