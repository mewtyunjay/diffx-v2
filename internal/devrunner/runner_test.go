package devrunner

import (
	"path/filepath"
	"testing"
	"time"

	"github.com/fsnotify/fsnotify"
)

func TestOptionsWithDefaults(t *testing.T) {
	t.Parallel()

	config := optionsWithDefaults(Options{})

	if config.BuildOutput != filepath.Join(".", "./cmd/bin/diffx-server") {
		t.Fatalf("expected default build output, got %q", config.BuildOutput)
	}
	if config.DebounceDelay != defaultDebounceDelay {
		t.Fatalf("expected default debounce delay, got %s", config.DebounceDelay)
	}
	if len(config.WatchRoots) != len(defaultWatchRoots) {
		t.Fatalf("expected %d watch roots, got %d", len(defaultWatchRoots), len(config.WatchRoots))
	}
	if config.WatchRoots[0] != "./cmd" || config.WatchRoots[1] != "./internal" {
		t.Fatalf("expected root watch roots, got %#v", config.WatchRoots)
	}
	if config.ServerCWD != "." {
		t.Fatalf("expected default server cwd ., got %q", config.ServerCWD)
	}
}

func TestOptionsWithDefaultsPreservesExplicitValues(t *testing.T) {
	t.Parallel()

	config := optionsWithDefaults(Options{
		BuildOutput:   "./tmp/server",
		DebounceDelay: time.Second,
		WatchRoots:    []string{"./custom"},
		WorkingDir:    "/repo/internal",
		ServerCWD:     "/repo",
	})

	if config.BuildOutput != filepath.Join("/repo/internal", "./tmp/server") {
		t.Fatalf("expected custom build output, got %q", config.BuildOutput)
	}
	if config.DebounceDelay != time.Second {
		t.Fatalf("expected custom debounce delay, got %s", config.DebounceDelay)
	}
	if len(config.WatchRoots) != 1 || config.WatchRoots[0] != "./custom" {
		t.Fatalf("expected custom watch roots, got %#v", config.WatchRoots)
	}
	if config.WorkingDir != "/repo/internal" {
		t.Fatalf("expected custom working dir, got %q", config.WorkingDir)
	}
	if config.ServerCWD != "/repo" {
		t.Fatalf("expected custom server cwd, got %q", config.ServerCWD)
	}
}

func TestShouldReload(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name  string
		event fsnotify.Event
		want  bool
	}{
		{
			name:  "go write event",
			event: fsnotify.Event{Name: "main.go", Op: fsnotify.Write},
			want:  true,
		},
		{
			name:  "go create event",
			event: fsnotify.Event{Name: "main.go", Op: fsnotify.Create},
			want:  true,
		},
		{
			name:  "non go file",
			event: fsnotify.Event{Name: "main.ts", Op: fsnotify.Write},
			want:  false,
		},
		{
			name:  "remove event ignored",
			event: fsnotify.Event{Name: "main.go", Op: fsnotify.Remove},
			want:  false,
		},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			if got := shouldReload(tt.event); got != tt.want {
				t.Fatalf("expected %t, got %t", tt.want, got)
			}
		})
	}
}
