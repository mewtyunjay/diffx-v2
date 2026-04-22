package gitstatus

import (
	"path/filepath"
	"testing"
)

func TestCountConflictBlocks(t *testing.T) {
	testCases := []struct {
		name     string
		contents string
		want     int
	}{
		{
			name:     "no markers",
			contents: "line one\nline two\n",
			want:     0,
		},
		{
			name:     "single marker block",
			contents: "<<<<<<< HEAD\nours\n=======\ntheirs\n>>>>>>> incoming\n",
			want:     1,
		},
		{
			name:     "multiple marker blocks",
			contents: "<<<<<<< HEAD\nours\n=======\ntheirs\n>>>>>>> incoming\n\n<<<<<<< HEAD\none\n=======\ntwo\n>>>>>>> incoming\n",
			want:     2,
		},
	}

	for _, testCase := range testCases {
		testCase := testCase
		t.Run(testCase.name, func(t *testing.T) {
			got := countConflictBlocks(testCase.contents)
			if got != testCase.want {
				t.Fatalf("countConflictBlocks() = %d, want %d", got, testCase.want)
			}
		})
	}
}

func TestReadConflictBlocksRemaining(t *testing.T) {
	repoRoot := t.TempDir()
	conflictedPath := filepath.Join(repoRoot, "conflicted.txt")
	writeFile(t, conflictedPath, "<<<<<<< HEAD\nours\n=======\ntheirs\n>>>>>>> incoming\n")

	got, err := readConflictBlocksRemaining(repoRoot, "conflicted.txt")
	if err != nil {
		t.Fatalf("readConflictBlocksRemaining returned error: %v", err)
	}

	if got != 1 {
		t.Fatalf("readConflictBlocksRemaining returned %d, want 1", got)
	}
}
