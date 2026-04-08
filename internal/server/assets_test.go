package server

import (
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"testing/fstest"
)

func TestLoadAssetsUsesEmbeddedDist(t *testing.T) {
	t.Parallel()

	assets, err := loadAssets(fstest.MapFS{
		"dist/index.html": &fstest.MapFile{
			Data: []byte("<!doctype html>"),
		},
		"dist/assets/app.js": &fstest.MapFile{
			Data: []byte("console.log('ok')"),
		},
	})
	if err != nil {
		t.Fatalf("loadAssets returned error: %v", err)
	}

	indexHTML, err := fs.ReadFile(assets, "index.html")
	if err != nil {
		t.Fatalf("read embedded index.html: %v", err)
	}
	if string(indexHTML) != "<!doctype html>" {
		t.Fatalf("index.html = %q, want embedded asset", string(indexHTML))
	}
}

func TestLoadAssetsDoesNotFallBackToWorkingDirectoryFrontend(t *testing.T) {
	tempDir := t.TempDir()
	t.Chdir(tempDir)

	frontendDir := filepath.Join(tempDir, "frontend", "dist")
	if err := os.MkdirAll(frontendDir, 0o755); err != nil {
		t.Fatalf("mkdir frontend dist: %v", err)
	}
	if err := os.WriteFile(filepath.Join(tempDir, "frontend", "package.json"), []byte("{}"), 0o644); err != nil {
		t.Fatalf("write package.json: %v", err)
	}
	if err := os.WriteFile(filepath.Join(frontendDir, "index.html"), []byte("local fallback"), 0o644); err != nil {
		t.Fatalf("write local index.html: %v", err)
	}

	_, err := loadAssets(fstest.MapFS{
		"dist/.keep": &fstest.MapFile{Data: []byte{}},
	})
	if err == nil {
		t.Fatal("expected missing embedded assets error")
	}
	if !strings.Contains(err.Error(), "embedded frontend assets are missing dist/index.html") {
		t.Fatalf("expected missing embedded assets error, got %v", err)
	}
}
