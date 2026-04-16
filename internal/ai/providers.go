package ai

import (
	"bytes"
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

type runner interface {
	Run(ctx context.Context, binaryPath string, args []string, workingDir string) (stdout string, stderr string, err error)
}

type execRunner struct{}

func (runner execRunner) Run(
	ctx context.Context,
	binaryPath string,
	args []string,
	workingDir string,
) (string, string, error) {
	command := exec.CommandContext(ctx, binaryPath, args...)
	if workingDir != "" {
		command.Dir = workingDir
	}

	var stdoutBuffer bytes.Buffer
	var stderrBuffer bytes.Buffer
	command.Stdout = &stdoutBuffer
	command.Stderr = &stderrBuffer

	err := command.Run()
	return strings.TrimSpace(stdoutBuffer.String()), strings.TrimSpace(stderrBuffer.String()), err
}

type providerSpec struct {
	ID            ProviderID
	Label         string
	BinaryName    string
	KnownPathFunc func(homeDir string) []string
	Probe         func(ctx context.Context, runner runner, binaryPath string) (string, error)
}

func defaultProviderSpecs() []providerSpec {
	return []providerSpec{
		{
			ID:         ProviderCodex,
			Label:      "Codex",
			BinaryName: "codex",
			KnownPathFunc: func(homeDir string) []string {
				return []string{
					filepath.Join(homeDir, ".local", "bin", "codex"),
					filepath.Join(homeDir, ".diffx", "bin", "codex"),
				}
			},
			Probe: probeCodexHeadless,
		},
		{
			ID:         ProviderClaude,
			Label:      "Claude",
			BinaryName: "claude",
			KnownPathFunc: func(homeDir string) []string {
				return []string{
					filepath.Join(homeDir, ".local", "bin", "claude"),
					filepath.Join(homeDir, ".diffx", "bin", "claude"),
				}
			},
			Probe: probeClaudeHeadless,
		},
	}
}

func detectProviderStatus(
	ctx context.Context,
	runner runner,
	homeDir string,
	spec providerSpec,
) AgentStatus {
	status := AgentStatus{
		ID:       spec.ID,
		Label:    spec.Label,
		Checking: false,
	}

	binaryPath, reason := resolveProviderBinaryPath(spec.BinaryName, spec.KnownPathFunc(homeDir))
	if binaryPath == "" {
		status.Reason = reason
		return status
	}

	status.BinaryPath = binaryPath
	status.Available = true

	probeCtx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	probeReason, err := spec.Probe(probeCtx, runner, binaryPath)
	if err != nil {
		if probeReason == "" {
			probeReason = err.Error()
		}
		status.Reason = probeReason
		return status
	}

	status.HeadlessCapable = true
	status.Selectable = true
	status.Reason = probeReason

	return status
}

func resolveProviderBinaryPath(binaryName string, knownPaths []string) (string, string) {
	if resolvedPath, err := exec.LookPath(binaryName); err == nil {
		return resolvedPath, "found in PATH"
	}

	for _, candidatePath := range knownPaths {
		if candidatePath == "" {
			continue
		}
		if !isExecutableFile(candidatePath) {
			continue
		}

		return candidatePath, fmt.Sprintf("found at %s", candidatePath)
	}

	return "", "binary not found in PATH or common install locations"
}

func isExecutableFile(path string) bool {
	info, err := os.Stat(path)
	if err != nil || info.IsDir() {
		return false
	}

	mode := info.Mode()
	if mode&0o111 != 0 {
		return true
	}

	return filepath.Ext(path) == ".exe"
}

func probeCodexHeadless(ctx context.Context, runner runner, binaryPath string) (string, error) {
	stdout, stderr, err := runner.Run(ctx, binaryPath, []string{"exec", "--help"}, "")
	combined := strings.ToLower(strings.TrimSpace(strings.Join([]string{stdout, stderr}, "\n")))
	if err != nil {
		return "unable to run codex headless probe", err
	}
	if strings.Contains(combined, "run codex non-interactively") ||
		strings.Contains(combined, "usage: codex exec") {
		return "headless via codex exec", nil
	}

	return "codex binary is present but does not expose `codex exec` help output", fmt.Errorf("headless probe failed")
}

func probeClaudeHeadless(ctx context.Context, runner runner, binaryPath string) (string, error) {
	stdout, stderr, err := runner.Run(ctx, binaryPath, []string{"--help"}, "")
	combined := strings.ToLower(strings.TrimSpace(strings.Join([]string{stdout, stderr}, "\n")))
	if err != nil {
		return "unable to run claude headless probe", err
	}
	if strings.Contains(combined, "-p, --print") ||
		strings.Contains(combined, "--print") {
		return "headless via claude -p", nil
	}

	return "claude binary is present but does not expose `-p/--print`", fmt.Errorf("headless probe failed")
}
