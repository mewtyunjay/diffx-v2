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
		{ID: "opencode", Label: "OpenCode (.opencode/skills)", SkillsPath: filepath.Join(homeDir, ".opencode", "skills")},
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
