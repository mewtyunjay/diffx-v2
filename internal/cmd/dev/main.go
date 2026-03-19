package main

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/fsnotify/fsnotify"
)

const (
	debounceDelay = 500 * time.Millisecond
	buildOutput   = "./cmd/bin/diffx-server"
)

var watchRoots = []string{
	"./cmd",
	"./gitstatus",
}

type backendRunner struct {
	mu  sync.Mutex
	cmd *exec.Cmd
}

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		exitf("failed to create watcher: %v", err)
	}
	defer watcher.Close()

	if err := addWatchDirs(watcher, watchRoots); err != nil {
		exitf("failed to configure watcher: %v", err)
	}

	runner := &backendRunner{}
	if err := runner.start(); err != nil {
		fmt.Fprintf(os.Stderr, "Initial backend build failed:\n%s\n", err)
	}

	var (
		reloadTimer  *time.Timer
		reloadNeeded bool
	)

	for {
		var timerChan <-chan time.Time
		if reloadTimer != nil {
			timerChan = reloadTimer.C
		}

		select {
		case <-ctx.Done():
			stopTimer(reloadTimer)
			if err := runner.stop(); err != nil {
				fmt.Fprintf(os.Stderr, "Failed to stop backend: %v\n", err)
			}
			return
		case <-timerChan:
			reloadTimer = nil
			if !reloadNeeded {
				continue
			}

			reloadNeeded = false
			drainWatcherEvents(watcher)
			fmt.Println("Changes settled, rebuilding backend...")
			if err := runner.restart(); err != nil {
				fmt.Fprintf(os.Stderr, "Backend restart failed:\n%s\n", err)
			}
		case event, ok := <-watcher.Events:
			if !ok {
				_ = runner.stop()
				return
			}
			if !shouldReload(event) {
				continue
			}

			if !reloadNeeded {
				fmt.Printf("File change detected: %s\n", event.Name)
			}
			reloadNeeded = true
			reloadTimer = resetTimer(reloadTimer, debounceDelay)
		case err, ok := <-watcher.Errors:
			if !ok {
				_ = runner.stop()
				return
			}
			fmt.Fprintf(os.Stderr, "Watcher error: %v\n", err)
		}
	}
}

func addWatchDirs(watcher *fsnotify.Watcher, roots []string) error {
	for _, root := range roots {
		if err := filepath.WalkDir(root, func(path string, d fs.DirEntry, walkErr error) error {
			if walkErr != nil {
				return walkErr
			}
			if !d.IsDir() {
				return nil
			}
			if shouldSkipDir(path) {
				return filepath.SkipDir
			}
			return watcher.Add(path)
		}); err != nil {
			return err
		}
	}

	return nil
}

func shouldSkipDir(path string) bool {
	cleanPath := filepath.Clean(path)
	return cleanPath == filepath.Clean(filepath.Dir(buildOutput))
}

func shouldReload(event fsnotify.Event) bool {
	if !strings.HasSuffix(event.Name, ".go") {
		return false
	}

	return event.Op&fsnotify.Write == fsnotify.Write ||
		event.Op&fsnotify.Create == fsnotify.Create ||
		event.Op&fsnotify.Rename == fsnotify.Rename
}

func resetTimer(timer *time.Timer, delay time.Duration) *time.Timer {
	if timer == nil {
		return time.NewTimer(delay)
	}

	if !timer.Stop() {
		select {
		case <-timer.C:
		default:
		}
	}
	timer.Reset(delay)
	return timer
}

func stopTimer(timer *time.Timer) {
	if timer == nil {
		return
	}
	if !timer.Stop() {
		select {
		case <-timer.C:
		default:
		}
	}
}

func drainWatcherEvents(watcher *fsnotify.Watcher) {
	for {
		select {
		case _, ok := <-watcher.Events:
			if !ok {
				return
			}
		default:
			return
		}
	}
}

func (r *backendRunner) start() error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if err := os.MkdirAll(filepath.Dir(buildOutput), 0o755); err != nil {
		return fmt.Errorf("create build directory: %w", err)
	}

	fmt.Println("Building backend...")
	buildCmd := exec.Command("go", "build", "-o", buildOutput, "./cmd/server")
	var buildOutputBuffer bytes.Buffer
	buildCmd.Stdout = &buildOutputBuffer
	buildCmd.Stderr = &buildOutputBuffer
	if err := buildCmd.Run(); err != nil {
		message := strings.TrimSpace(buildOutputBuffer.String())
		if message == "" {
			message = err.Error()
		}
		return errors.New(message)
	}

	cmd := exec.Command(buildOutput)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("start backend: %w", err)
	}

	r.cmd = cmd
	fmt.Printf("Backend started. PID: %d\n", cmd.Process.Pid)
	return nil
}

func (r *backendRunner) stop() error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.cmd == nil || r.cmd.Process == nil {
		return nil
	}

	fmt.Println("Stopping backend process...")
	waitCh := make(chan error, 1)
	go func(cmd *exec.Cmd) {
		waitCh <- cmd.Wait()
	}(r.cmd)

	if err := r.cmd.Process.Signal(os.Interrupt); err != nil {
		if killErr := r.cmd.Process.Kill(); killErr != nil {
			return fmt.Errorf("stop backend: interrupt error: %w; kill error: %w", err, killErr)
		}
	}

	select {
	case waitErr := <-waitCh:
		r.cmd = nil
		if waitErr != nil && !isExpectedExit(waitErr) {
			return fmt.Errorf("wait for backend exit: %w", waitErr)
		}
		return nil
	case <-time.After(2 * time.Second):
		if err := r.cmd.Process.Kill(); err != nil {
			return fmt.Errorf("kill backend after timeout: %w", err)
		}
		waitErr := <-waitCh
		r.cmd = nil
		if waitErr != nil && !isExpectedExit(waitErr) {
			return fmt.Errorf("wait after forced kill: %w", waitErr)
		}
		return nil
	}
}

func (r *backendRunner) restart() error {
	if err := r.stop(); err != nil {
		return err
	}
	return r.start()
}

func isExpectedExit(err error) bool {
	var exitErr *exec.ExitError
	return errors.As(err, &exitErr)
}

func exitf(format string, args ...any) {
	fmt.Fprintf(os.Stderr, format+"\n", args...)
	os.Exit(1)
}
