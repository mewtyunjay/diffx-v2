package main

import (
	"os"
	"path/filepath"
)

type setupTarget struct {
	ID         string
	Label      string
	SkillsPath string
	Exists     bool
}

func buildSetupTargets(homeDir string) []setupTarget {
	targets := []setupTarget{
		{ID: "universal", Label: "Universal (.agents/skills)", SkillsPath: filepath.Join(homeDir, ".agents", "skills")},
		{ID: "claude", Label: "Claude Code (.claude/skills)", SkillsPath: filepath.Join(homeDir, ".claude", "skills")},
		{ID: "codex", Label: "Codex (.codex/skills)", SkillsPath: filepath.Join(homeDir, ".codex", "skills")},
		{ID: "cursor", Label: "Cursor (.cursor/skills)", SkillsPath: filepath.Join(homeDir, ".cursor", "skills")},
		{ID: "cline", Label: "Cline (.cline/skills)", SkillsPath: filepath.Join(homeDir, ".cline", "skills")},
		{ID: "continue", Label: "Continue (.continue/skills)", SkillsPath: filepath.Join(homeDir, ".continue", "skills")},
		{ID: "opencode", Label: "OpenCode (.opencode/skills)", SkillsPath: filepath.Join(homeDir, ".opencode", "skills")},
		{ID: "kilo", Label: "Kilo (.kilo/skills)", SkillsPath: filepath.Join(homeDir, ".kilo", "skills")},
		{ID: "kiro", Label: "Kiro (.kiro/skills)", SkillsPath: filepath.Join(homeDir, ".kiro", "skills")},
		{ID: "warp", Label: "Warp (.warp/skills)", SkillsPath: filepath.Join(homeDir, ".warp", "skills")},
		{ID: "gemini-cli", Label: "Gemini CLI (.gemini/skills)", SkillsPath: filepath.Join(homeDir, ".gemini", "skills")},
		{ID: "github-copilot", Label: "GitHub Copilot (.github-copilot/skills)", SkillsPath: filepath.Join(homeDir, ".github-copilot", "skills")},
		{ID: "augment", Label: "Augment (.augment/skills)", SkillsPath: filepath.Join(homeDir, ".augment", "skills")},
		{ID: "command-code", Label: "Command Code (.commandcode/skills)", SkillsPath: filepath.Join(homeDir, ".commandcode", "skills")},
		{ID: "cortex-code", Label: "Cortex Code (.cortex/skills)", SkillsPath: filepath.Join(homeDir, ".cortex", "skills")},
	}

	for index := range targets {
		if info, err := os.Stat(targets[index].SkillsPath); err == nil && info.IsDir() {
			targets[index].Exists = true
		}
	}

	return targets
}

func defaultTargetSelection() map[string]bool {
	return map[string]bool{
		"universal": true,
		"claude":    true,
	}
}
