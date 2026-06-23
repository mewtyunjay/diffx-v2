package ai

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"os/exec"
	"sort"
	"strings"
	"sync"
	"time"
)

const (
	maxCommitPromptDiffChars     = 120000
	maxCommitPromptFileDiffChars = 20000
)

const (
	defaultCodexCommitModel  = "gpt-5.4-mini"
	defaultClaudeCommitModel = "claude-sonnet-4-6"
)

type Service struct {
	repoRoot  string
	scopePath string
	homeDir   string

	store configStore

	runner runner
	specs  []providerSpec
	logger *slog.Logger

	mu               sync.RWMutex
	agentStatusByID  map[ProviderID]AgentStatus
	agentsRefreshing bool
	bootProbeStarted bool
}

func NewService(repoRoot string, scopePath string, loggers ...*slog.Logger) (*Service, error) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return nil, fmt.Errorf("resolve home directory: %w", err)
	}

	var logger *slog.Logger
	if len(loggers) > 0 {
		logger = loggers[0]
	}

	service := &Service{
		repoRoot:         repoRoot,
		scopePath:        scopePath,
		homeDir:          homeDir,
		store:            newConfigStore(homeDir),
		runner:           execRunner{},
		specs:            defaultProviderSpecs(),
		logger:           logger,
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
		status := detectProviderStatus(ctx, s.runner, s.homeDir, spec)
		statuses[spec.ID] = status
	}

	s.mu.Lock()
	s.agentStatusByID = statuses
	s.agentsRefreshing = false
	agents := s.snapshotAgentsLocked()
	s.mu.Unlock()

	s.logDebug("providers", "summary", formatAgentSummary(agents))

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

	diffText, err := s.loadScopedStagedDiffContext(ctx)
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
			"--setting-sources",
			"user",
		}
		workingDir = os.TempDir()
	default:
		return "", fmt.Errorf("unsupported provider %q", provider)
	}

	runCtx, cancel := context.WithTimeout(ctx, 45*time.Second)
	defer cancel()

	started := time.Now()
	logArgs := redactProviderCommandArgs(provider, args)
	s.logDebug(
		fmt.Sprintf("%s exec start", provider),
		"binary", agentStatus.BinaryPath,
		"working_dir", displayWorkingDir(workingDir),
		"args", strings.Join(logArgs, " "),
		"diff_chars", len(diffText),
	)

	stdout, stderr, err := s.runner.Run(runCtx, agentStatus.BinaryPath, args, workingDir)
	duration := time.Since(started).Round(time.Millisecond)
	if err != nil {
		diagnostic := providerFailureDiagnostic(stderr, stdout, err)
		s.logError(
			fmt.Sprintf("%s: %s", provider, diagnostic),
			"binary", agentStatus.BinaryPath,
			"working_dir", displayWorkingDir(workingDir),
			"args", strings.Join(logArgs, " "),
			"duration", duration,
			"stderr", truncateLogValue(providerFailureDiagnostic(stderr, "", nil), 300),
			"stdout", truncateLogValue(providerFailureDiagnostic("", stdout, nil), 300),
			"error", err.Error(),
		)
		return "", fmt.Errorf("%s headless execution failed: %s", provider, diagnostic)
	}

	message := sanitizeCommitMessage(stdout)
	if message == "" {
		message = sanitizeCommitMessage(stderr)
	}
	if message == "" {
		s.logError(
			fmt.Sprintf("%s exec empty", provider),
			"binary", agentStatus.BinaryPath,
			"working_dir", displayWorkingDir(workingDir),
			"args", strings.Join(logArgs, " "),
			"duration", duration,
			"stderr", truncateLogValue(firstNonEmptyLine(stderr), 300),
			"stdout", truncateLogValue(firstNonEmptyLine(stdout), 300),
		)
		return "", fmt.Errorf("%s returned an empty commit message", provider)
	}

	s.logDebug(
		fmt.Sprintf("%s exec ok", provider),
		"binary", agentStatus.BinaryPath,
		"working_dir", displayWorkingDir(workingDir),
		"duration", duration,
	)

	return message, nil
}

func (s *Service) loadScopedStagedDiffContext(ctx context.Context) (string, error) {
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

	summary, err := s.readStagedSummary(ctx)
	if err != nil {
		return "", err
	}

	var builder strings.Builder
	builder.WriteString(summary)
	builder.WriteString("\n\nFile diff excerpts:\n")

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

	sections := splitGitDiffSections(diffOutput)
	for index, section := range sections {
		if builder.Len() >= maxCommitPromptDiffChars {
			builder.WriteString("\n[remaining file diffs omitted by diffx for prompt safety]\n")
			break
		}

		builder.WriteString("\n")

		remainingFiles := len(sections) - index
		remainingChars := maxCommitPromptDiffChars - builder.Len()
		fileLimit := maxCommitPromptFileDiffChars
		if perFileLimit := remainingChars / remainingFiles; perFileLimit < fileLimit {
			fileLimit = perFileLimit
		}
		if fileLimit <= 0 {
			builder.WriteString("[diff omitted by diffx for prompt safety]\n")
			continue
		}

		builder.WriteString(truncatePromptSection(section, fileLimit, "[file diff truncated by diffx for prompt safety]\n"))
	}

	contextText := builder.String()
	if !strings.Contains(contextText, "diff --git") {
		return "", &NoStagedChangesInScopeError{}
	}

	return contextText, nil
}

func splitGitDiffSections(diffOutput string) []string {
	var sections []string
	var builder strings.Builder

	for _, line := range strings.SplitAfter(diffOutput, "\n") {
		if strings.HasPrefix(line, "diff --git ") && builder.Len() > 0 {
			sections = append(sections, builder.String())
			builder.Reset()
		}
		builder.WriteString(line)
	}
	if builder.Len() > 0 {
		sections = append(sections, builder.String())
	}

	return sections
}

func (s *Service) readStagedSummary(ctx context.Context) (string, error) {
	branch, _ := s.runGit(ctx, "branch", "--show-current")

	nameStatusArgs := []string{"diff", "--cached", "--name-status"}
	statArgs := []string{"diff", "--cached", "--stat"}
	if s.scopePath != "." {
		nameStatusArgs = append(nameStatusArgs, "--", s.scopePath)
		statArgs = append(statArgs, "--", s.scopePath)
	}

	nameStatus, err := s.runGit(ctx, nameStatusArgs...)
	if err != nil {
		return "", err
	}
	stat, err := s.runGit(ctx, statArgs...)
	if err != nil {
		return "", err
	}

	var builder strings.Builder
	builder.WriteString("Repository context:\n")
	builder.WriteString("- branch: ")
	if trimmedBranch := strings.TrimSpace(branch); trimmedBranch != "" {
		builder.WriteString(trimmedBranch)
	} else {
		builder.WriteString("detached or unknown")
	}
	builder.WriteString("\n- scope: ")
	builder.WriteString(s.scopePath)
	builder.WriteString("\n\nStaged files:\n")
	builder.WriteString(strings.TrimSpace(nameStatus))
	builder.WriteString("\n\nStaged stat:\n")
	builder.WriteString(strings.TrimSpace(stat))

	return builder.String(), nil
}

func truncatePromptSection(value string, limit int, note string) string {
	if len(value) <= limit {
		return value
	}

	trimmed := strings.TrimSpace(value[:limit])
	return trimmed + "\n\n" + note
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
- Do not imitate previous commit messages or local commit history.
- Name the actual behavior or user-visible outcome when the diff shows one.
- Avoid vague subjects like "update files" or "improve code".
- Use a conventional prefix such as feat:, fix:, refactor:, test:, docs:, or chore: only when it clearly fits.

Staged context:
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

func providerFailureDiagnostic(stderr string, stdout string, runErr error) string {
	for _, value := range []string{stderr, stdout} {
		if line := preferredDiagnosticLine(value); line != "" {
			return line
		}
	}

	for _, value := range []string{stderr, stdout} {
		if line := firstUsefulDiagnosticLine(value); line != "" {
			return line
		}
	}

	if runErr != nil {
		return runErr.Error()
	}

	return ""
}

func preferredDiagnosticLine(value string) string {
	for _, line := range diagnosticLines(value) {
		lower := strings.ToLower(line)
		if strings.HasPrefix(lower, "warning:") {
			continue
		}
		switch {
		case strings.HasPrefix(lower, "error:"):
			return strings.TrimSpace(line[len("error:"):])
		case strings.HasPrefix(lower, "fatal:"):
			return line
		case strings.Contains(lower, "operation not permitted"):
			return line
		case strings.Contains(lower, "permission denied"):
			return line
		case strings.Contains(lower, "not logged in"):
			return line
		case strings.Contains(lower, "unauthorized"):
			return line
		case strings.Contains(lower, "authentication"):
			return line
		}
	}

	return ""
}

func firstUsefulDiagnosticLine(value string) string {
	for _, line := range diagnosticLines(value) {
		lower := strings.ToLower(line)
		if strings.HasPrefix(lower, "warning:") {
			continue
		}
		if strings.Contains(lower, "reading additional input from stdin") {
			continue
		}
		return line
	}

	return ""
}

func diagnosticLines(value string) []string {
	var lines []string
	for _, line := range strings.Split(strings.ReplaceAll(value, "\r\n", "\n"), "\n") {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" {
			continue
		}
		lines = append(lines, trimmed)
	}

	return lines
}

func (s *Service) logDebug(message string, args ...any) {
	if s.logger == nil {
		return
	}

	s.logger.Debug(message, args...)
}

func (s *Service) logError(message string, args ...any) {
	if s.logger == nil {
		return
	}

	s.logger.Error(message, args...)
}

func redactProviderCommandArgs(provider ProviderID, args []string) []string {
	redacted := append([]string(nil), args...)
	switch provider {
	case ProviderCodex:
		if len(redacted) > 0 {
			redacted[len(redacted)-1] = "<prompt>"
		}
	case ProviderClaude:
		for index := 0; index < len(redacted)-1; index++ {
			if redacted[index] == "-p" || redacted[index] == "--print" {
				redacted[index+1] = "<prompt>"
				index++
			}
		}
	}

	return redacted
}

func displayWorkingDir(workingDir string) string {
	if strings.TrimSpace(workingDir) == "" {
		return "<default>"
	}

	return workingDir
}

func truncateLogValue(value string, maxLength int) string {
	if len(value) <= maxLength {
		return value
	}
	if maxLength <= 3 {
		return value[:maxLength]
	}

	return value[:maxLength-3] + "..."
}

func formatAgentSummary(agents []AgentStatus) string {
	parts := make([]string, 0, len(agents))
	for _, agent := range agents {
		status := "unavailable"
		switch {
		case agent.Selectable:
			status = "ok"
		case agent.Available:
			status = "not-ready"
		}

		detail := strings.TrimSpace(agent.BinaryPath)
		if detail == "" {
			detail = strings.TrimSpace(agent.Reason)
		}
		if detail != "" {
			parts = append(parts, fmt.Sprintf("%s=%s (%s)", agent.ID, status, detail))
			continue
		}

		parts = append(parts, fmt.Sprintf("%s=%s", agent.ID, status))
	}

	return strings.Join(parts, ", ")
}
