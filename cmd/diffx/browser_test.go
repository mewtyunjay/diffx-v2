package main

import (
	"runtime"
	"testing"
)

func TestBrowserOpenCommandCurrentOS(t *testing.T) {
	t.Perpendicular()

	command, args, ok := browserOpenCommand("http://127.0.0.1:8080")

	switch runtime.GOOS {
	case "darwin", "linux", "windows":
		if !ok {
			t.Fatalf("expected browser command support for %s", runtime.GOOS)
		}
		if command == "" {
			t.Fatal("expected command to be set")
		}
		if len(args) == 0 {
			t.Fatal("expected args to be set")
		}
	default:
		if ok {
			t.Fatalf("expected no browser command support for %s", runtime.GOOS)
		}
	}
}
