package main

import (
	"flag"
	"fmt"
	"io"
	"os"
	"slices"
	"strings"
)

type setupConfig struct {
	yes        bool
	agentsCSV  string
	useSymlink bool
	listAgents bool
}

func runSetup(args []string, stdout, stderr io.Writer) error {
	cfg, err := parseSetupConfig(args, stderr)
	if err != nil {
		return err
	}

	homeDir, err := os.UserHomeDir()
	if err != nil {
		return fmt.Errorf("resolve home directory: %w", err)
	}

	targets := buildSetupTargets(homeDir)
	if cfg.listAgents {
		printSetupTargets(stdout, targets)
		return nil
	}

	selectedSet, err := resolveTargetSelection(cfg, targets, stdout, stderr)
	if err != nil {
		return err
	}

	selectedTargets := selectedTargetsFromSet(targets, selectedSet)
	if len(selectedTargets) == 0 {
		return fmt.Errorf("at least one target must be selected")
	}

	if err := writeCanonicalSkill(homeDir); err != nil {
		return err
	}

	canonicalDir := canonicalSkillDir(homeDir)
	for _, target := range selectedTargets {
		if err := installSkillIntoTarget(target, canonicalDir, cfg.useSymlink, stdout); err != nil {
			return err
		}
	}

	if selectedSet["claude"] {
		if err := writeClaudeCommand(homeDir); err != nil {
			return err
		}
	}

	fmt.Fprintln(stdout, "setup: done")
	fmt.Fprintf(stdout, "setup: canonical skill: %s\n", canonicalSkillPath(homeDir))
	fmt.Fprintf(stdout, "setup: targets: %s\n", joinTargetIDs(selectedTargets))

	return nil
}

func parseSetupConfig(args []string, stderr io.Writer) (setupConfig, error) {
	cfg := setupConfig{
		useSymlink: true,
	}

	copyMode := false
	flagSet := flag.NewFlagSet("diffx setup", flag.ContinueOnError)
	flagSet.SetOutput(stderr)
	flagSet.BoolVar(&cfg.yes, "yes", false, "Run non-interactively using defaults or provided --agents")
	flagSet.StringVar(&cfg.agentsCSV, "agents", "", "Comma-separated agent IDs (e.g. universal,claude,codex)")
	flagSet.BoolVar(&copyMode, "copy", false, "Copy skill files instead of symlinking")
	flagSet.BoolVar(&cfg.useSymlink, "symlink", cfg.useSymlink, "Symlink skill files (default)")
	flagSet.BoolVar(&cfg.listAgents, "list-agents", false, "Print available agent targets and exit")
	flagSet.Usage = func() {
		fmt.Fprintln(flagSet.Output(), "Usage: diffx setup [--yes] [--agents universal,claude] [--copy] [--list-agents]")
		flagSet.PrintDefaults()
	}

	if err := flagSet.Parse(args); err != nil {
		return setupConfig{}, err
	}
	if flagSet.NArg() > 0 {
		return setupConfig{}, fmt.Errorf("unexpected arguments: %s", strings.Join(flagSet.Args(), " "))
	}
	if copyMode {
		cfg.useSymlink = false
	}

	return cfg, nil
}

func resolveTargetSelection(cfg setupConfig, targets []setupTarget, stdout, stderr io.Writer) (map[string]bool, error) {
	if cfg.agentsCSV != "" {
		return parseSelectionCSV(cfg.agentsCSV, targets)
	}
	if cfg.yes {
		return defaultTargetSelection(), nil
	}
	if !isInteractiveTerminal() {
		fmt.Fprintln(stderr, "setup: no interactive terminal detected, using defaults (--yes behavior)")
		return defaultTargetSelection(), nil
	}

	return runSetupTUI(targets, defaultTargetSelection())
}

func isInteractiveTerminal() bool {
	stdinInfo, err := os.Stdin.Stat()
	if err != nil {
		return false
	}
	stdoutInfo, err := os.Stdout.Stat()
	if err != nil {
		return false
	}

	return (stdinInfo.Mode()&os.ModeCharDevice) != 0 && (stdoutInfo.Mode()&os.ModeCharDevice) != 0
}

func printSetupTargets(output io.Writer, targets []setupTarget) {
	fmt.Fprintln(output, "Available agent targets:")
	defaults := defaultTargetSelection()
	for _, target := range targets {
		marker := ""
		if defaults[target.ID] {
			marker = " [default]"
		}
		fmt.Fprintf(output, "  - %s -> %s (%s)%s\n", target.ID, target.Label, target.SkillsPath, marker)
	}
}

func joinTargetIDs(targets []setupTarget) string {
	ids := make([]string, 0, len(targets))
	for _, target := range targets {
		ids = append(ids, target.ID)
	}
	slices.Sort(ids)

	return strings.Join(ids, ",")
}
