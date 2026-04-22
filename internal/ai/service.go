package ai

import (
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"sort"
	"strings"
	"sync"
	"time"
)

const maxCommitPromptDiffChars = 120000

const (
	defaultCodexCommitModel  = "gpt-5.4-codex-spark"
	defaultClaudeCommitModel = "haiku"
)

type Service struct {
	repoRoot  string
	scopePath string
	homeDir   string

	store configStore

	runner runner
	specs  []providerSpec

	mu               sync.RWMutex
	agentStatusByID  map[ProviderID]AgentStatus
	agentsRefreshing bool
	bootProbeStarted bool
}

func NewService(repoRoot string, scopePath string) (*Service, error) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return nil, fmt.Errorf("resolve home directory: %w", err)
	}

	service := &Service{
		repoRoot:         repoRoot,
		scopePath:        scopePath,
		homeDir:          homeDir,
		store:            newConfigStore(homeDir),
		runner:           execRunner{},
		specs:            defaultProviderSpecs(),
		agentStatusByID:  make(map[ProviderID]AgentStatus),
		agentsRefreshing: false,
		bootProbeStarted: false,
	}

	service.setCheckingStateLocked()

	return service, nil
}

func (s *Service) GetAgents() ([]AgentStatus, bool) {
	s.ensureBootProbe()

	s.mu.RLock()
	defer s.mu.RUnlock()

	agents := s.snapshotAgentsLocked()
	return agents, s.agentsRefreshing
}

func (s *Service) RefreshAgents(ctx context.Context) ([]AgentStatus, error) {
	s.mu.Lock()
	s.setCheckingStateLocked()
	s.mu.Unlock()

	statuses := make(map[ProviderID]AgentStatus, len(s.specs))
	for _, spec := range s.specs {
		statuses[spec.ID] = detectProviderStatus(ctx, s.runner, s.homeDir, spec)
	}

	s.mu.Lock()
	s.agentStatusByID = statuses
	s.agentsRefreshing = false
	agents := s.snapshotAgentsLocked()
	s.mu.Unlock()

	return agents, nil
}

func (s *Service) GetSettings() (SettingsResponse, error) {
	s.ensureBootProbe()

	providers, err := s.store.LoadFeatureProviders()
	if err != nil {
		return SettingsResponse{}, err
	}
	providers.Normalize()

	agents, isChecking := s.GetAgents()
	agentByID := make(map[ProviderID]AgentStatus, len(agents))
	for _, agent := range agents {
		agentByID[agent.ID] = agent
	}

	suggestedProvider := suggestProvider(agents)

	featureStates := make([]FeatureState, 0, len(allFeatures))
	for _, feature := range allFeatures {
		provider := providers.ProviderForFeature(feature)
		providerStatus, hasProvider := agentByID[provider]
		featureStates = append(featureStates, FeatureState{
			FeatureID:         feature,
			Provider:          provider,
			ProviderValid:     hasProvider && providerStatus.Selectable,
			SuggestedProvider: suggestedProvider,
		})
	}

	return SettingsResponse{
		Features:         providers,
		FeatureStates:    featureStates,
		Agents:           agents,
		IsCheckingAgents: isChecking,
	}, nil
}

func (s *Service) UpdateSettings(ctx context.Context, providers FeatureProviders) (SettingsResponse, error) {
	providers.Normalize()

	refreshCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	agents, err := s.RefreshAgents(refreshCtx)
	if err != nil {
		return SettingsResponse{}, err
	}

	agentByID := make(map[ProviderID]AgentStatus, len(agents))
	for _, agent := range agents {
		agentByID[agent.ID] = agent
	}

	for _, feature := range allFeatures {
		provider := providers.ProviderForFeature(feature)
		if provider == "" {
			return SettingsResponse{}, &FeatureProviderValidationError{Feature: feature}
		}

		status, ok := agentByID[provider]
		if !ok || !status.Selectable {
			reason := "provider is unavailable"
			if ok && status.Reason != "" {
				reason = status.Reason
			}
			return SettingsResponse{}, &FeatureProviderValidationError{
				Feature:  feature,
				Provider: provider,
				Reason:   reason,
			}
		}
	}

	if err := s.store.SaveFeatureProviders(providers); err != nil {
		return SettingsResponse{}, err
	}

	return s.GetSettings()
}

func (s *Service) SuggestCommitMessage(ctx context.Context) (CommitMessageSuggestion, error) {
	providers, err := s.store.LoadFeatureProviders()
	if err != nil {
		return CommitMessageSuggestion{}, err
	}
	providers.Normalize()

	provider := providers.CommitMessage
	if provider == "" {
		return CommitMessageSuggestion{}, &FeatureProviderNotConfiguredError{Feature: FeatureCommitMessage}
	}

	refreshCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	agents, err := s.RefreshAgents(refreshCtx)
	if err != nil {
		return CommitMessageSuggestion{}, err
	}

	agentStatus := findAgentStatus(agents, provider)
	if agentStatus == nil || !agentStatus.Selectable {
		reason := "provider is unavailable"
		if agentStatus != nil && agentStatus.Reason != "" {
			reason = agentStatus.Reason
		}
		return CommitMessageSuggestion{}, &FeatureProviderValidationError{
			Feature:  FeatureCommitMessage,
			Provider: provider,
			Reason:   reason,
		}
	}

	diffText, err := s.loadScopedStagedDiff(ctx)
	if err != nil {
		return CommitMessageSuggestion{}, err
	}

	message, err := s.generateCommitMessageWithProvider(ctx, provider, diffText)
	if err != nil {
		return CommitMessageSuggestion{}, err
	}

	return CommitMessageSuggestion{
		Provider: provider,
		Message:  message,
	}, nil
}

func (s *Service) generateCommitMessageWithProvider(
	ctx context.Context,
	provider ProviderID,
	diffText string,
) (string, error) {
	spec, ok := s.specForProvider(provider)
	if !ok {
		return "", fmt.Errorf("unsupported provider %q", provider)
	}

	agents, _ := s.GetAgents()
	agentStatus := findAgentStatus(agents, provider)
	if agentStatus == nil || agentStatus.BinaryPath == "" {
		return "", fmt.Errorf("provider %q is not available", provider)
	}

	prompt := buildCommitMessagePrompt(diffText)

	var args []string
	workingDir := s.repoRoot
	switch spec.ID {
	case ProviderCodex:
		args = []string{
			"exec",
			"--model",
			defaultCodexCommitModel,
			"--sandbox",
			"read-only",
			"--skip-git-repo-check",
			"--cd",
			s.repoRoot,
			prompt,
		}
		workingDir = ""
	case ProviderClaude:
		args = []string{
			"--model",
			defaultClaudeCommitModel,
			"-p",
			prompt,
			"--output-format",
			"text",
			"--max-turns",
			"2",
		}
	default:
		return "", fmt.Errorf("unsupported provider %q", provider)
	}

	runCtx, cancel := context.WithTimeout(ctx, 45*time.Second)
	defer cancel()

	stdout, stderr, err := s.runner.Run(runCtx, agentStatus.BinaryPath, args, workingDir)
	if err != nil {
		firstLine := firstNonEmptyLine(stderr)
		if firstLine == "" {
			firstLine = firstNonEmptyLine(stdout)
		}
		if firstLine == "" {
			firstLine = err.Error()
		}
		return "", fmt.Errorf("%s headless execution failed: %s", provider, firstLine)
	}

	message := sanitizeCommitMessage(stdout)
	if message == "" {
		message = sanitizeCommitMessage(stderr)
	}
	if message == "" {
		return "", fmt.Errorf("%s returned an empty commit message", provider)
	}

	return message, nil
}

func (s *Service) loadScopedStagedDiff(ctx context.Context) (string, error) {
	allNames, err := s.readStagedNames(ctx, false)
	if err != nil {
		return "", err
	}

	scopedNames, err := s.readStagedNames(ctx, true)
	if err != nil {
		return "", err
	}

	if len(scopedNames) == 0 {
		return "", &NoStagedChangesInScopeError{}
	}

	hiddenCount := len(allNames) - len(scopedNames)
	if hiddenCount > 0 {
		return "", &HiddenScopedStagedChangesError{HiddenCount: hiddenCount}
	}

	diffArgs := []string{"diff", "--cached", "--no-color"}
	if s.scopePath != "." {
		diffArgs = append(diffArgs, "--", s.scopePath)
	}

	diffOutput, err := s.runGit(ctx, diffArgs...)
	if err != nil {
		return "", err
	}
	if strings.TrimSpace(diffOutput) == "" {
		return "", &NoStagedChangesInScopeError{}
	}

	if len(diffOutput) > maxCommitPromptDiffChars {
		trimmed := diffOutput[:maxCommitPromptDiffChars]
		diffOutput = trimmed + "\n\n[diff truncated by diffx for prompt safety]\n"
	}

	return diffOutput, nil
}

func (s *Service) readStagedNames(ctx context.Context, scoped bool) ([]string, error) {
	args := []string{"diff", "--cached", "--name-only"}
	if scoped && s.scopePath != "." {
		args = append(args, "--", s.scopePath)
	}

	output, err := s.runGit(ctx, args...)
	if err != nil {
		return nil, err
	}

	unique := make(map[string]struct{})
	for _, line := range strings.Split(output, "\n") {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" {
			continue
		}
		unique[trimmed] = struct{}{}
	}

	names := make([]string, 0, len(unique))
	for name := range unique {
		names = append(names, name)
	}
	sort.Strings(names)

	return names, nil
}

func (s *Service) runGit(ctx context.Context, args ...string) (string, error) {
	commandArgs := append([]string{"-C", s.repoRoot}, args...)
	command := exec.CommandContext(ctx, "git", commandArgs...)
	output, err := command.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("git %s: %w", strings.Join(args, " "), errors.New(strings.TrimSpace(string(output))))
	}

	return string(output), nil
}

func (s *Service) setCheckingStateLocked() {
	s.agentsRefreshing = true
	for _, spec := range s.specs {
		s.agentStatusByID[spec.ID] = AgentStatus{
			ID:       spec.ID,
			Label:    spec.Label,
			Checking: true,
			Reason:   "checking provider availability",
		}
	}
}

func (s *Service) ensureBootProbe() {
	s.mu.Lock()
	if s.bootProbeStarted {
		s.mu.Unlock()
		return
	}
	s.bootProbeStarted = true
	s.mu.Unlock()

	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_, _ = s.RefreshAgents(ctx)
	}()
}

func (s *Service) snapshotAgentsLocked() []AgentStatus {
	agents := make([]AgentStatus, 0, len(s.specs))
	for _, spec := range s.specs {
		agent, ok := s.agentStatusByID[spec.ID]
		if !ok {
			agent = AgentStatus{ID: spec.ID, Label: spec.Label, Reason: "provider status unavailable"}
		}
		agents = append(agents, agent)
	}

	return agents
}

func (s *Service) specForProvider(provider ProviderID) (providerSpec, bool) {
	for _, spec := range s.specs {
		if spec.ID == provider {
			return spec, true
		}
	}

	return providerSpec{}, false
}

func suggestProvider(agents []AgentStatus) ProviderID {
	for _, provider := range allProviders {
		status := findAgentStatus(agents, provider)
		if status != nil && status.Selectable {
			return provider
		}
	}

	return ""
}

func findAgentStatus(agents []AgentStatus, provider ProviderID) *AgentStatus {
	for index := range agents {
		if agents[index].ID == provider {
			return &agents[index]
		}
	}

	return nil
}

func buildCommitMessagePrompt(diffText string) string {
	return strings.TrimSpace(`You are generating a git commit message from staged changes.

Rules:
- Return exactly one commit subject line.
- Plain text only. No quotes, markdown, bullets, or explanations.
- Use imperative mood.
- Keep it under 72 characters when possible.
- Prefer clarity over cleverness.

Staged diff:
` + "\n" + diffText)
}

func sanitizeCommitMessage(raw string) string {
	line := firstNonEmptyLine(raw)
	line = strings.TrimSpace(line)
	line = strings.Trim(line, "`\"'")
	line = strings.TrimSpace(line)
	if line == "" {
		return ""
	}

	if len(line) > 120 {
		line = strings.TrimSpace(line[:120])
	}

	return line
}

func firstNonEmptyLine(value string) string {
	for _, line := range strings.Split(value, "\n") {
		trimmed := strings.TrimSpace(line)
		if trimmed != "" {
			return trimmed
		}
	}

	return ""
}
