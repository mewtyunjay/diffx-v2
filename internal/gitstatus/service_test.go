package gitstatus

import "testing"

func TestParsePorcelainStatus(t *testing.T) {
	output := []byte(" M frontend/src/App.tsx\x00?? frontend/src/app/changed-files/api.ts\x00R  frontend/src/new.tsx\x00frontend/src/old.tsx\x00")

	files, err := parsePorcelainStatus(output, t.TempDir())
	if err != nil {
		t.Fatalf("parsePorcelainStatus returned error: %v", err)
	}

	if len(files) != 3 {
		t.Fatalf("expected 3 files, got %d", len(files))
	}

	if files[0].Path != "frontend/src/App.tsx" || files[0].Status != StatusModified {
		t.Fatalf("unexpected first file: %#v", files[0])
	}

	if files[1].Path != "frontend/src/app/changed-files/api.ts" || files[1].Status != StatusAdded || files[1].IsTracked {
		t.Fatalf("unexpected second file: %#v", files[1])
	}

	if files[2].Path != "frontend/src/new.tsx" || files[2].Status != StatusRenamed || !files[2].HasStagedChanges {
		t.Fatalf("unexpected renamed file: %#v", files[2])
	}
}

func TestResolveRepoPathRejectsEscape(t *testing.T) {
	repoRoot := t.TempDir()

	if _, err := ResolveRepoPath(repoRoot, "../outside.txt"); err == nil {
		t.Fatal("expected path traversal to be rejected")
	}
}
