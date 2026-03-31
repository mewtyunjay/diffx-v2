package main

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"diffx/devrunner"
)

type command int

const (
	commandHelp command = iota
	commandDev
	commandInstall
	commandBuild
	commandPackage
)

const usageText = `diffx developer CLI

Usage:
  ./cli dev
  ./cli install
  ./cli build
  ./cli package
`

func main() {
	if err := run(os.Args[1:]); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func run(args []string) error {
	cmd, err := parseCommand(args)
	if err != nil {
		return err
	}

	switch cmd {
	case commandHelp:
		fmt.Fprint(os.Stdout, usageText)
		return nil
	case commandDev:
		return runDev()
	case commandInstall:
		return runInstall()
	case commandBuild:
		return runBuild()
	case commandPackage:
		return runPackage()
	default:
		return fmt.Errorf("unsupported command")
	}
}

func parseCommand(args []string) (command, error) {
	if len(args) == 0 {
		return commandHelp, nil
	}

	switch args[0] {
	case "help", "-h", "--help":
		if len(args) > 1 {
			return commandHelp, fmt.Errorf("help does not accept additional arguments")
		}
		return commandHelp, nil
	case "dev":
		if len(args) > 1 {
			return commandDev, fmt.Errorf("dev does not accept additional arguments")
		}
		return commandDev, nil
	case "install":
		if len(args) > 1 {
			return commandInstall, fmt.Errorf("install does not accept additional arguments")
		}
		return commandInstall, nil
	case "build":
		if len(args) > 1 {
			return commandBuild, fmt.Errorf("build does not accept additional arguments")
		}
		return commandBuild, nil
	case "package", "build-package":
		if len(args) > 1 {
			return commandPackage, fmt.Errorf("%s does not accept additional arguments", args[0])
		}
		return commandPackage, nil
	default:
		return commandHelp, fmt.Errorf("unknown command %q\n\n%s", args[0], usageText)
	}
}

func runDev() error {
	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()

	frontendPrefix := newPrefixWriter(os.Stdout, "frontend")
	backendPrefix := newPrefixWriter(os.Stdout, "backend")
	errorPrefix := newPrefixWriter(os.Stderr, "cli")

	frontend, err := startManagedProcess(
		"frontend",
		filepath.Clean("../frontend"),
		frontendPrefix,
		frontendPrefix,
		"npm",
		"run",
		"dev",
	)
	if err != nil {
		return fmt.Errorf("start frontend dev server: %w", err)
	}
	defer frontend.Stop()

	backendErrCh := make(chan error, 1)
	go func() {
		backendErrCh <- devrunner.Run(ctx, devrunner.Options{
			Stdout: backendPrefix,
			Stderr: backendPrefix,
		})
	}()

	frontendErrCh := make(chan error, 1)
	go func() {
		frontendErrCh <- frontend.Wait()
	}()

	healthErrCh := make(chan error, 1)
	go func() {
		healthErrCh <- waitForHealthyServer(ctx, "http://localhost:8080/api/hello", 20*time.Second)
	}()

	var runErr error
	for {
		select {
		case <-ctx.Done():
			runErr = nil
			goto shutdown
		case err := <-frontendErrCh:
			if ctx.Err() != nil {
				runErr = nil
			} else if err == nil {
				runErr = errors.New("frontend exited unexpectedly")
			} else {
				runErr = fmt.Errorf("frontend exited: %w", err)
			}
			goto shutdown
		case err := <-backendErrCh:
			if ctx.Err() != nil {
				runErr = nil
			} else if err == nil {
				runErr = errors.New("backend exited unexpectedly")
			} else {
				runErr = fmt.Errorf("backend exited: %w", err)
			}
			goto shutdown
		case err := <-healthErrCh:
			if err == nil {
				fmt.Fprintf(errorPrefix, "Development environment ready. Frontend: http://localhost:5173  Backend: http://localhost:8080\n")
			} else if !errors.Is(err, context.Canceled) {
				fmt.Fprintf(errorPrefix, "Backend is still warming up: %v\n", err)
			}
			healthErrCh = nil
		}
	}

shutdown:
	cancel()
	_ = frontend.Stop()
	waitForShutdown(frontendErrCh, backendErrCh)
	return runErr
}

func runInstall() error {
	if err := runCommand("backend", ".", "go", "mod", "download"); err != nil {
		return err
	}
	return runCommand("frontend", filepath.Clean("../frontend"), "npm", "install")
}

func runBuild() error {
	if err := runCommand("frontend", filepath.Clean("../frontend"), "npm", "run", "build"); err != nil {
		return err
	}

	if err := os.MkdirAll("./cmd/bin", 0o755); err != nil {
		return fmt.Errorf("create build output directory: %w", err)
	}

	return runCommand("backend", ".", "go", "build", "-o", "./cmd/bin/diffx-server", "./cmd/server")
}

func runPackage() error {
	return runCommand("package", filepath.Clean(".."), "npm", "run", "build:package")
}

type managedProcess struct {
	name string
	cmd  *exec.Cmd
}

func startManagedProcess(name, dir string, stdout, stderr io.Writer, command string, args ...string) (*managedProcess, error) {
	cmd := exec.Command(command, args...)
	cmd.Dir = dir
	cmd.Stdout = stdout
	cmd.Stderr = stderr
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}

	if err := cmd.Start(); err != nil {
		return nil, err
	}

	return &managedProcess{name: name, cmd: cmd}, nil
}

func (p *managedProcess) Wait() error {
	return p.cmd.Wait()
}

func (p *managedProcess) Stop() error {
	if p == nil || p.cmd == nil || p.cmd.Process == nil {
		return nil
	}

	if err := syscall.Kill(-p.cmd.Process.Pid, syscall.SIGTERM); err != nil && !isProcessAlreadyGone(err) {
		if killErr := p.cmd.Process.Kill(); killErr != nil && !isProcessAlreadyGone(killErr) {
			return fmt.Errorf("stop %s: %w", p.name, killErr)
		}
	}

	return nil
}

func waitForShutdown(frontendErrCh, backendErrCh <-chan error) {
	waitCtx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	for frontendErrCh != nil || backendErrCh != nil {
		select {
		case <-waitCtx.Done():
			return
		case <-frontendErrCh:
			frontendErrCh = nil
		case <-backendErrCh:
			backendErrCh = nil
		}
	}
}

func runCommand(component, dir, command string, args ...string) error {
	writer := newPrefixWriter(os.Stdout, component)
	cmd := exec.Command(command, args...)
	cmd.Dir = dir
	cmd.Stdout = writer
	cmd.Stderr = writer
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("%s command failed: %w", component, err)
	}
	return nil
}

func waitForHealthyServer(ctx context.Context, url string, timeout time.Duration) error {
	deadlineCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	client := &http.Client{Timeout: 2 * time.Second}
	ticker := time.NewTicker(500 * time.Millisecond)
	defer ticker.Stop()

	for {
		req, err := http.NewRequestWithContext(deadlineCtx, http.MethodGet, url, nil)
		if err != nil {
			return err
		}

		resp, err := client.Do(req)
		if err == nil {
			_ = resp.Body.Close()
			if resp.StatusCode >= 200 && resp.StatusCode < 300 {
				return nil
			}
		}

		select {
		case <-deadlineCtx.Done():
			return deadlineCtx.Err()
		case <-ticker.C:
		}
	}
}

func isProcessAlreadyGone(err error) bool {
	return errors.Is(err, os.ErrProcessDone) || errors.Is(err, syscall.ESRCH)
}

type prefixWriter struct {
	target io.Writer
	prefix string
	buffer strings.Builder
}

func newPrefixWriter(target io.Writer, prefix string) *prefixWriter {
	return &prefixWriter{
		target: target,
		prefix: fmt.Sprintf("[%s] ", prefix),
	}
}

func (w *prefixWriter) Write(p []byte) (int, error) {
	w.buffer.Write(p)

	for {
		line := w.buffer.String()
		index := strings.IndexByte(line, '\n')
		if index == -1 {
			break
		}

		chunk := line[:index]
		if _, err := fmt.Fprintf(w.target, "%s%s\n", w.prefix, chunk); err != nil {
			return 0, err
		}

		w.buffer.Reset()
		w.buffer.WriteString(line[index+1:])
	}

	return len(p), nil
}
