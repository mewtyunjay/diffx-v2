package ai

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"testing"
)

type probeCommandResult struct {
	stdout string
	stderr string
	err    error
}

type probeRunner struct {
	results map[string]probeCommandResult
}

func (runner probeRunner) Run(
	_ context.Context,
	binaryPath string,
	args []string,
	_ string,
) (string, string, error) {
	key := fmt.Sprintf("%s %s", binaryPath, strings.Join(args, " "))
	result, ok := runner.results[key]
	if !ok {
		return "", "", fmt.Errorf("unexpected command: %s", key)
	}

	return result.stdout, result.stderr, result.err
}

func TestProbeClaudeHeadlessRequiresCredentials(t *testing.T) {
	t.Parallel()

	binaryPath := "/tmp/claude"
	runner := probeRunner{
		results: map[string]probeCommandResult{
			binaryPath + " --help": {
				stdout: "Usage: claude\n  -p, --print",
			},
			binaryPath + " auth status": {
				stdout: `{"loggedIn":false,"authMethod":"none","apiProvider":"firstParty"}`,
				err:    errors.New("exit status 1"),
			},
		},
	}

	reason, err := probeClaudeHeadless(context.Background(), runner, binaryPath)
	if err == nil {
		t.Fatal("expected missing credentials error, got nil")
	}
	if !strings.Contains(reason, "credentials not detected") {
		t.Fatalf("expected credentials reason, got %q", reason)
	}
}

func TestProbeClaudeHeadlessAcceptsLoggedInStatus(t *testing.T) {
	t.Parallel()

	binaryPath := "/tmp/claude"
	runner := probeRunner{
		results: map[string]probeCommandResult{
			binaryPath + " --help": {
				stdout: "Usage: claude\n  -p, --print",
			},
			binaryPath + " auth status": {
				stdout: `{"loggedIn":true,"authMethod":"oauth"}`,
			},
		},
	}

	reason, err := probeClaudeHeadless(context.Background(), runner, binaryPath)
	if err != nil {
		t.Fatalf("expected logged in status to pass, got error: %v", err)
	}
	if reason != "headless via claude -p" {
		t.Fatalf("unexpected reason: %q", reason)
	}
}

func TestProbeClaudeHeadlessRejectsWhenAuthCommandUnsupported(t *testing.T) {
	t.Parallel()

	binaryPath := "/tmp/claude"
	runner := probeRunner{
		results: map[string]probeCommandResult{
			binaryPath + " --help": {
				stdout: "Usage: claude\n  -p, --print",
			},
			binaryPath + " auth status": {
				stderr: "error: unknown command 'auth'",
				err:    errors.New("exit status 1"),
			},
		},
	}

	reason, err := probeClaudeHeadless(context.Background(), runner, binaryPath)
	if err == nil {
		t.Fatal("expected unsupported auth command to be rejected, got nil error")
	}
	if !strings.Contains(reason, "too old for headless credential detection") {
		t.Fatalf("unexpected reason: %q", reason)
	}
}
