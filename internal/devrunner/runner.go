package devrunner

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"
)

const defaultDebounceDelay = 500 * time.Millisecond

var defaultWatchRoots = []string{
	"./cmd",
	"./gitstatus",
}

type Options struct {
	BuildOutput   string
	DebounceDelay time.Duration
	WatchRoots    []string
	Stdout        io.Writer
	Stderr        io.Writer
}

func Run(ctx context.Context, opts Options) error {
	config := optionsWithDefaults(opts)

	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		return fmt.Errorf("create watcher: %w", err)
	}
	defer watcher.Close()

	if err := addWatchDirs(watcher, config.WatchRoots, config.BuildOutput); err != nil {
		return fmt.Errorf("configure watcher: %w", err)
	}

	runner := &backendRunner{
		buildOutput: config.BuildOutput,
		stdout:      config.Stdout,
		stderr:      config.Stderr,
	}
	if err := runner.start(); err != nil {
		fmt.Fprintf(config.Stderr, "Initial backend build failed:\n%s\n", err)
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
				fmt.Fprintf(config.Stderr, "Failed to stop backend: %v\n", err)
			}
			return nil
		case <-timerChan:
			reloadTimer = nil
			if !reloadNeeded {
				continue
			}

			reloadNeeded = false
			drainWatcherEvents(watcher)
			fmt.Fprintln(config.Stdout, "Changes settled, rebuilding backend...")
			if err := runner.restart(); err != nil {
				fmt.Fprintf(config.Stderr, "Backend restart failed:\n%s\n", err)
			}
		case event, ok := <-watcher.Events:
			if !ok {
				_ = runner.stop()
				return nil
			}
			if !shouldReload(event) {
				continue
			}

			if !reloadNeeded {
				fmt.Fprintf(config.Stdout, "File change detected: %s\n", event.Name)
			}
			reloadNeeded = true
			reloadTimer = resetTimer(reloadTimer, config.DebounceDelay)
		case err, ok := <-watcher.Errors:
			if !ok {
				_ = runner.stop()
				return nil
			}
			fmt.Fprintf(config.Stderr, "Watcher error: %v\n", err)
		}
	}
}

type runtimeOptions struct {
	BuildOutput   string
	DebounceDelay time.Duration
	WatchRoots    []string
	Stdout        io.Writer
	Stderr        io.Writer
}

func optionsWithDefaults(opts Options) runtimeOptions {
	buildOutput := strings.TrimSpace(opts.BuildOutput)
	if buildOutput == "" {
		buildOutput = "./cmd/bin/diffx-server"
	}

	debounceDelay := opts.DebounceDelay
	if debounceDelay <= 0 {
		debounceDelay = defaultDebounceDelay
	}

	watchRoots := opts.WatchRoots
	if len(watchRoots) == 0 {
		watchRoots = append([]string(nil), defaultWatchRoots...)
	}

	stdout := opts.Stdout
	if stdout == nil {
		stdout = os.Stdout
	}

	stderr := opts.Stderr
	if stderr == nil {
		stderr = os.Stderr
	}

	return runtimeOptions{
		BuildOutput:   buildOutput,
		DebounceDelay: debounceDelay,
		WatchRoots:    watchRoots,
		Stdout:        stdout,
		Stderr:        stderr,
	}
}

type backendRunner struct {
	mu          sync.Mutex
	cmd         *exec.Cmd
	buildOutput string
	stdout      io.Writer
	stderr      io.Writer
}

func addWatchDirs(watcher *fsnotify.Watcher, roots []string, buildOutput string) error {
	for _, root := range roots {
		if err := filepath.WalkDir(root, func(path string, d fs.DirEntry, walkErr error) error {
			if walkErr != nil {
				return walkErr
			}
			if !d.IsDir() {
				return nil
			}
			if shouldSkipDir(path, buildOutput) {
				return filepath.SkipDir
			}
			return watcher.Add(path)
		}); err != nil {
			return err
		}
	}

	return nil
}

func shouldSkipDir(path, buildOutput string) bool {
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

	if err := os.MkdirAll(filepath.Dir(r.buildOutput), 0o755); err != nil {
		return fmt.Errorf("create build directory: %w", err)
	}

	fmt.Fprintln(r.stdout, "Building backend...")
	buildCmd := exec.Command("go", "build", "-o", r.buildOutput, "./cmd/server")
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

	cmd := exec.Command(r.buildOutput)
	cmd.Stdout = r.stdout
	cmd.Stderr = r.stderr
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("start backend: %w", err)
	}

	r.cmd = cmd
	fmt.Fprintf(r.stdout, "Backend started. PID: %d\n", cmd.Process.Pid)
	return nil
}

func (r *backendRunner) stop() error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.cmd == nil || r.cmd.Process == nil {
		return nil
	}

	fmt.Fprintln(r.stdout, "Stopping backend process...")
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
