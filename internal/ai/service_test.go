package ai

import (
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

type stubRunner struct {
	stdoutByCommand map[string]string
}

func (runner stubRunner) Run(
	_ context.Context,
	binaryPath string,
	args []string,
	_ string,
) (string, string, error) {
	key := fmt.Sprintf("%s %s", binaryPath, strings.Join(args, " "))
	if output, ok := runner.stdoutByCommand[key]; ok {
		return output, "", nil
	}

	return "", "", fmt.Errorf("unexpected command: %s", key)
}

func TestServiceUpdateSettingsRejectsUnavailableProvider(t *testing.T) {
	t.Parallel()

	homeDir := t.TempDir()
	codexPath := filepath.Join(homeDir, "codex")
	if err := os.WriteFile(codexPath, []byte("#!/bin/sh\n"), 0o755); err != nil {
		t.Fatalf("write codex stub: %v", err)
	}

	service := &Service{
		repoRoot:        t.TempDir(),
		scopePath:       ".",
		homeDir:         homeDir,
		store:           configStore{configPath: filepath.Join(homeDir, ".diffx", "config.json")},
		runner:          stubRunner{},
		agentStatusByID: make(map[ProviderID]AgentStatus),
		specs: []providerSpec{
			{
				ID:         ProviderCodex,
				Label:      "Codex",
				BinaryName: "codex-test",
				KnownPathFunc: func(_ string) []string {
					return []string{codexPath}
				},
				Probe: func(_ context.Context, _ runner, _ string) (string, error) {
					return "headless via codex exec", nil
				},
			},
			{
				ID:         ProviderClaude,
				Label:      "Claude",
				BinaryName: "claude-test",
				KnownPathFunc: func(_ string) []string {
					return nil
				},
				Probe: func(_ context.Context, _ runner, _ string) (string, error) {
					return "", errors.New("not available")
				},
			},
		},
	}
	service.setCheckingStateLocked()

	_, err := service.UpdateSettings(context.Background(), FeatureProviders{
		CommitMessage: ProviderClaude,
	})
	if err == nil {
		t.Fatal("expected validation error, got nil")
	}

	var validationErr *FeatureProviderValidationError
	if !errors.As(err, &validationErr) {
		t.Fatalf("expected FeatureProviderValidationError, got %T: %v", err, err)
	}
	if validationErr.Feature != FeatureCommitMessage {
		t.Fatalf("expected commitMessage feature error, got %#v", validationErr)
	}
}

func TestServiceSuggestCommitMessageUsesConfiguredProvider(t *testing.T) {
	t.Parallel()

	homeDir := t.TempDir()
	repoRoot := createRepoWithStagedChange(t)
	codexPath := filepath.Join(homeDir, "codex")
	if err := os.WriteFile(codexPath, []byte("#!/bin/sh\n"), 0o755); err != nil {
		t.Fatalf("write codex stub: %v", err)
	}

	store := configStore{configPath: filepath.Join(homeDir, ".diffx", "config.json")}
	if err := store.SaveFeatureProviders(FeatureProviders{
		CommitMessage: ProviderCodex,
	}); err != nil {
		t.Fatalf("save providers: %v", err)
	}

	service := &Service{
		repoRoot:  repoRoot,
		scopePath: ".",
		homeDir:   homeDir,
		store:     store,
		runner: stubRunner{
			stdoutByCommand: map[string]string{},
		},
		agentStatusByID: make(map[ProviderID]AgentStatus),
		specs: []providerSpec{
			{
				ID:         ProviderCodex,
				Label:      "Codex",
				BinaryName: "codex-test",
				KnownPathFunc: func(_ string) []string {
					return []string{codexPath}
				},
				Probe: func(_ context.Context, _ runner, _ string) (string, error) {
					return "headless via codex exec", nil
				},
			},
		},
	}
	service.setCheckingStateLocked()

	// Install a runner after boot probing so we can assert command output.
	service.runner = serviceCommitRunner{
		binaryPath: codexPath,
		repoRoot:   repoRoot,
	}

	suggestion, err := service.SuggestCommitMessage(context.Background())
	if err != nil {
		t.Fatalf("SuggestCommitMessage returned error: %v", err)
	}

	if suggestion.Provider != ProviderCodex {
		t.Fatalf("expected codex provider, got %#v", suggestion)
	}
	if suggestion.Message != "feat: improve notes content" {
		t.Fatalf("unexpected commit message suggestion: %#v", suggestion)
	}

}

func TestServiceSuggestCommitMessageUsesClaudeDefaultModel(t *testing.T) {
	t.Parallel()

	homeDir := t.TempDir()
	repoRoot := createRepoWithStagedChange(t)
	claudePath := filepath.Join(homeDir, "claude")
	if err := os.WriteFile(claudePath, []byte("#!/bin/sh\n"), 0o755); err != nil {
		t.Fatalf("write claude stub: %v", err)
	}

	store := configStore{configPath: filepath.Join(homeDir, ".diffx", "config.json")}
	if err := store.SaveFeatureProviders(FeatureProviders{
		CommitMessage: ProviderClaude,
	}); err != nil {
		t.Fatalf("save providers: %v", err)
	}

	service := &Service{
		repoRoot:  repoRoot,
		scopePath: ".",
		homeDir:   homeDir,
		store:     store,
		runner: stubRunner{
			stdoutByCommand: map[string]string{},
		},
		agentStatusByID: make(map[ProviderID]AgentStatus),
		specs: []providerSpec{
			{
				ID:         ProviderClaude,
				Label:      "Claude",
				BinaryName: "claude-test",
				KnownPathFunc: func(_ string) []string {
					return []string{claudePath}
				},
				Probe: func(_ context.Context, _ runner, _ string) (string, error) {
					return "headless via claude -p", nil
				},
			},
		},
	}
	service.setCheckingStateLocked()

	service.runner = serviceClaudeCommitRunner{
		binaryPath: claudePath,
	}

	suggestion, err := service.SuggestCommitMessage(context.Background())
	if err != nil {
		t.Fatalf("SuggestCommitMessage returned error: %v", err)
	}
	if suggestion.Provider != ProviderClaude {
		t.Fatalf("expected claude provider, got %#v", suggestion)
	}
	if suggestion.Message != "fix: clarify settings model defaults" {
		t.Fatalf("unexpected commit message suggestion: %#v", suggestion)
	}
}

type serviceCommitRunner struct {
	binaryPath string
	repoRoot   string
}

func (runner serviceCommitRunner) Run(
	_ context.Context,
	binaryPath string,
	args []string,
	_ string,
) (string, string, error) {
	if binaryPath != runner.binaryPath {
		return "", "", fmt.Errorf("unexpected binary path: %s", binaryPath)
	}
	if len(args) < 9 {
		return "", "", fmt.Errorf("unexpected args: %v", args)
	}
	if args[0] != "exec" {
		return "", "", fmt.Errorf("expected codex exec call, got %v", args)
	}

	modelValue, ok := readStringFlagValue(args, "--model")
	if !ok {
		return "", "", fmt.Errorf("expected --model flag in args: %v", args)
	}
	if modelValue != defaultCodexCommitModel {
		return "", "", fmt.Errorf("expected codex model %q, got %q", defaultCodexCommitModel, modelValue)
	}

	repoRootValue, ok := readStringFlagValue(args, "--cd")
	if !ok {
		return "", "", fmt.Errorf("expected --cd flag in args: %v", args)
	}
	if repoRootValue != runner.repoRoot {
		return "", "", fmt.Errorf("expected repo root %s, got %s", runner.repoRoot, repoRootValue)
	}

	prompt := args[len(args)-1]
	if !strings.Contains(prompt, "diff --git") {
		return "", "", fmt.Errorf("expected staged diff in prompt")
	}

	return "feat: improve notes content\n\nextra details", "", nil
}

type serviceClaudeCommitRunner struct {
	binaryPath string
}

func (runner serviceClaudeCommitRunner) Run(
	_ context.Context,
	binaryPath string,
	args []string,
	_ string,
) (string, string, error) {
	if binaryPath != runner.binaryPath {
		return "", "", fmt.Errorf("unexpected binary path: %s", binaryPath)
	}
	if len(args) < 8 {
		return "", "", fmt.Errorf("unexpected args: %v", args)
	}

	modelValue, ok := readStringFlagValue(args, "--model")
	if !ok {
		return "", "", fmt.Errorf("expected --model flag in args: %v", args)
	}
	if modelValue != defaultClaudeCommitModel {
		return "", "", fmt.Errorf("expected claude model %q, got %q", defaultClaudeCommitModel, modelValue)
	}

	printPromptIndex := -1
	for index := 0; index < len(args)-1; index++ {
		if args[index] == "-p" {
			printPromptIndex = index + 1
			break
		}
	}
	if printPromptIndex == -1 {
		return "", "", fmt.Errorf("expected -p prompt flag in args: %v", args)
	}

	prompt := args[printPromptIndex]
	if !strings.Contains(prompt, "diff --git") {
		return "", "", fmt.Errorf("expected staged diff in prompt")
	}

	return "fix: clarify settings model defaults\n\nextra context", "", nil
}

func readStringFlagValue(args []string, flag string) (string, bool) {
	for index := 0; index < len(args)-1; index++ {
		if args[index] != flag {
			continue
		}

		return args[index+1], true
	}

	return "", false
}

func createRepoWithStagedChange(t *testing.T) string {
	t.Helper()

	repoRoot := t.TempDir()
	runGit(t, repoRoot, "init")
	runGit(t, repoRoot, "checkout", "-b", "main")
	runGit(t, repoRoot, "config", "user.email", "diffx@example.com")
	runGit(t, repoRoot, "config", "user.name", "Diffx Tests")

	notesPath := filepath.Join(repoRoot, "notes.txt")
	if err := os.WriteFile(notesPath, []byte("first\n"), 0o644); err != nil {
		t.Fatalf("write notes file: %v", err)
	}
	runGit(t, repoRoot, "add", "notes.txt")
	runGit(t, repoRoot, "commit", "-m", "initial")

	if err := os.WriteFile(notesPath, []byte("first\nsecond\n"), 0o644); err != nil {
		t.Fatalf("update notes file: %v", err)
	}
	runGit(t, repoRoot, "add", "notes.txt")

	return repoRoot
}

func runGit(t *testing.T, dir string, args ...string) {
	t.Helper()

	command := exec.Command("git", args...)
	command.Dir = dir
	output, err := command.CombinedOutput()
	if err != nil {
		t.Fatalf("git %v failed: %v\n%s", args, err, string(output))
	}
}
