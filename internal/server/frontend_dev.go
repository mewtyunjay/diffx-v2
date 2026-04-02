package server

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

const (
	frontendReadyTimeout = 15 * time.Second
	frontendProbeDelay   = 150 * time.Millisecond
	frontendStopTimeout  = 5 * time.Second
)

func shouldUseFrontendDev(cfg FrontendConfig) bool {
	if cfg.Static {
		return false
	}

	workingDir := cfg.WorkingDir
	if workingDir == "" {
		workingDir = "."
	}

	if cfg.DevURL == "" {
		return false
	}

	info, err := os.Stat(filepath.Join(workingDir, "frontend", "package.json"))
	return err == nil && !info.IsDir()
}

func newFrontendDevServer(cfg FrontendConfig) (http.Handler, func() error, error) {
	target, err := url.Parse(cfg.DevURL)
	if err != nil {
		return nil, nil, fmt.Errorf("parse frontend dev url %q: %w", cfg.DevURL, err)
	}

	if devServerReachable(target) {
		return newFrontendDevProxy(target), nil, nil
	}

	frontendDir := filepath.Join(cfg.WorkingDir, "frontend")
	command := exec.Command(
		"npm",
		"run",
		"dev",
		"--",
		"--host",
		target.Hostname(),
		"--port",
		target.Port(),
		"--strictPort",
	)
	command.Dir = frontendDir

	output := &lockedBuffer{}
	command.Stdout = output
	command.Stderr = output

	if err := command.Start(); err != nil {
		return nil, nil, fmt.Errorf("start frontend dev server: %w", err)
	}

	waitCh := make(chan error, 1)
	go func() {
		waitCh <- command.Wait()
	}()

	readyTimer := time.NewTimer(frontendReadyTimeout)
	defer readyTimer.Stop()

	probeTicker := time.NewTicker(frontendProbeDelay)
	defer probeTicker.Stop()

	for {
		if devServerReachable(target) {
			return newFrontendDevProxy(target), func() error {
				return stopFrontendProcess(command, waitCh)
			}, nil
		}

		select {
		case err := <-waitCh:
			return nil, nil, fmt.Errorf(
				"frontend dev server exited before becoming ready: %w\n%s",
				err,
				strings.TrimSpace(output.String()),
			)
		case <-probeTicker.C:
		case <-readyTimer.C:
			_ = stopFrontendProcess(command, waitCh)
			return nil, nil, fmt.Errorf(
				"frontend dev server did not become ready at %s within %s\n%s",
				target,
				frontendReadyTimeout,
				strings.TrimSpace(output.String()),
			)
		}
	}
}

func newFrontendDevProxy(target *url.URL) http.Handler {
	proxy := httputil.NewSingleHostReverseProxy(target)
	originalDirector := proxy.Director
	proxy.Director = func(request *http.Request) {
		originalDirector(request)
		request.Host = target.Host
	}
	proxy.ErrorHandler = func(writer http.ResponseWriter, request *http.Request, err error) {
		http.Error(
			writer,
			fmt.Sprintf("frontend dev server proxy error: %v", err),
			http.StatusBadGateway,
		)
	}

	return proxy
}

func devServerReachable(target *url.URL) bool {
	probeURL := target.ResolveReference(&url.URL{Path: "/@vite/client"})
	request, err := http.NewRequest(http.MethodGet, probeURL.String(), nil)
	if err != nil {
		return false
	}

	response, err := (&http.Client{Timeout: 500 * time.Millisecond}).Do(request)
	if err != nil {
		return false
	}
	defer response.Body.Close()
	_, _ = io.Copy(io.Discard, response.Body)

	return response.StatusCode == http.StatusOK
}

func stopFrontendProcess(command *exec.Cmd, waitCh <-chan error) error {
	if command.Process == nil {
		return nil
	}

	_ = command.Process.Signal(os.Interrupt)

	stopTimer := time.NewTimer(frontendStopTimeout)
	defer stopTimer.Stop()

	select {
	case err := <-waitCh:
		return normalizeExitError(err)
	case <-stopTimer.C:
		_ = command.Process.Kill()
		return normalizeExitError(<-waitCh)
	}
}

func normalizeExitError(err error) error {
	if err == nil {
		return nil
	}

	var exitErr *exec.ExitError
	if !errors.As(err, &exitErr) {
		return err
	}

	if exitErr.Success() {
		return nil
	}

	return err
}

type lockedBuffer struct {
	mu  sync.Mutex
	buf bytes.Buffer
}

func (b *lockedBuffer) Write(data []byte) (int, error) {
	b.mu.Lock()
	defer b.mu.Unlock()

	return b.buf.Write(data)
}

func (b *lockedBuffer) String() string {
	b.mu.Lock()
	defer b.mu.Unlock()

	return b.buf.String()
}
