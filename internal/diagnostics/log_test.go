package diagnostics

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestPurgeExpiredRemovesOnlyOldDiffxLogFiles(t *testing.T) {
	dir := t.TempDir()
	now := time.Date(2026, time.November, 21, 12, 0, 0, 0, time.UTC)
	files := map[string]time.Time{
		"diffx-2026-10-20.jsonl": now.Add(-retention - time.Second),
		"diffx-2026-10-22.jsonl": now.Add(-retention),
		"diffx-2026-11-20.jsonl": now.Add(-time.Hour),
		"other.jsonl":            now.Add(-2 * retention),
	}
	for name, modified := range files {
		path := filepath.Join(dir, name)
		if err := os.WriteFile(path, []byte("test"), 0o600); err != nil {
			t.Fatal(err)
		}
		if err := os.Chtimes(path, modified, modified); err != nil {
			t.Fatal(err)
		}
	}
	link := "diffx-2026-10-19.jsonl"
	if err := os.Symlink("other.jsonl", filepath.Join(dir, link)); err != nil {
		t.Fatal(err)
	}
	root, err := os.OpenRoot(dir)
	if err != nil {
		t.Fatal(err)
	}
	defer root.Close()

	if err := purgeExpired(root, now); err != nil {
		t.Fatal(err)
	}
	if _, err := root.Lstat("diffx-2026-10-20.jsonl"); !errors.Is(err, fs.ErrNotExist) {
		t.Fatalf("expired log still exists: %v", err)
	}
	for _, name := range []string{"diffx-2026-10-22.jsonl", "diffx-2026-11-20.jsonl", "other.jsonl", link} {
		if _, err := root.Lstat(name); err != nil {
			t.Errorf("expected %s to be retained: %v", name, err)
		}
	}
}

func TestDiagnosticsAppendPrivateRecordsAndRotate(t *testing.T) {
	dir := filepath.Join(t.TempDir(), "logs")
	log, err := Open(dir, io.Discard)
	if err != nil {
		t.Fatal(err)
	}
	defer log.Close()

	name := log.name
	NewLogger(log).Info("test request", "status", 200)
	NewLogger(log).Warn("test failure", "error", errors.New("permission denied"))
	data, err := os.ReadFile(filepath.Join(dir, name))
	if err != nil {
		t.Fatal(err)
	}
	lines := bytes.Split(bytes.TrimSpace(data), []byte{'\n'})
	if len(lines) != 2 || !json.Valid(lines[0]) || !json.Valid(lines[1]) {
		t.Fatalf("expected two JSON records, got %s", data)
	}
	info, err := os.Stat(filepath.Join(dir, name))
	if err != nil {
		t.Fatal(err)
	}
	if info.Mode().Perm() != 0o600 {
		t.Errorf("log permissions = %o", info.Mode().Perm())
	}

	if err := log.rotate(time.Now().Add(48 * time.Hour)); err != nil {
		t.Fatal(err)
	}
	if log.name == name {
		t.Fatal("new UTC day reused the previous log file")
	}
}

func TestLoggerRedactsCredentialsFromMessagesAndErrors(t *testing.T) {
	var output bytes.Buffer
	NewLogger(&output).Error("Authorization: Bearer abc123",
		"error", errors.New("https://user:pass@example.com/private?token=tokenvalue"),
		"hint", "ghp_test_secret")
	got := output.String()
	for _, secret := range []string{"abc123", "user:pass", "tokenvalue", "ghp_test_secret"} {
		if strings.Contains(got, secret) {
			t.Errorf("log contains %q: %s", secret, got)
		}
	}
	if !strings.Contains(got, "example.com/private") || !strings.Contains(got, "[redacted]") {
		t.Errorf("expected useful redacted context, got %s", got)
	}
}
