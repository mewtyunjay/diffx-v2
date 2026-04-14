package main

import (
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"time"
)

func canonicalSkillDir(homeDir string) string {
	dataHome := os.Getenv("XDG_DATA_HOME")
	if dataHome == "" {
		dataHome = filepath.Join(homeDir, ".local", "share")
	}

	return filepath.Join(dataHome, "diffx", "skills", "diffx")
}

func canonicalSkillPath(homeDir string) string {
	return filepath.Join(canonicalSkillDir(homeDir), "SKILL.md")
}

func claudeCommandPath(homeDir string) string {
	return filepath.Join(homeDir, ".claude", "commands", "diffx.md")
}

func writeCanonicalSkill(homeDir string) error {
	dir := canonicalSkillDir(homeDir)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return fmt.Errorf("create canonical skill dir: %w", err)
	}

	if err := os.WriteFile(canonicalSkillPath(homeDir), []byte(diffxSkillContent), 0o644); err != nil {
		return fmt.Errorf("write canonical skill: %w", err)
	}

	return nil
}

func writeClaudeCommand(homeDir string) error {
	path := claudeCommandPath(homeDir)
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return fmt.Errorf("create claude command dir: %w", err)
	}

	if err := os.WriteFile(path, []byte(diffxClaudeCommandContent), 0o644); err != nil {
		return fmt.Errorf("write claude command: %w", err)
	}

	return nil
}

func installSkillIntoTarget(target setupTarget, canonicalDir string, useSymlink bool, stdout io.Writer) error {
	if err := os.MkdirAll(target.SkillsPath, 0o755); err != nil {
		return fmt.Errorf("create target directory %s: %w", target.SkillsPath, err)
	}

	targetEntry := filepath.Join(target.SkillsPath, "diffx")
	if isDesiredSymlink(targetEntry, canonicalDir) {
		return nil
	}

	if fileExists(targetEntry) {
		backupPath := targetEntry + ".backup." + time.Now().Format("20060102150405")
		if err := os.Rename(targetEntry, backupPath); err != nil {
			return fmt.Errorf("backup existing skill at %s: %w", targetEntry, err)
		}
		fmt.Fprintf(stdout, "setup: backed up existing %s -> %s\n", targetEntry, backupPath)
	}

	if useSymlink {
		if err := os.Symlink(canonicalDir, targetEntry); err == nil {
			return nil
		}
		fmt.Fprintf(stdout, "setup: symlink failed for %s, falling back to copy\n", targetEntry)
	}

	if err := copyDir(canonicalDir, targetEntry); err != nil {
		return fmt.Errorf("copy skill to %s: %w", targetEntry, err)
	}

	return nil
}

func isDesiredSymlink(path, expectedTarget string) bool {
	linkTarget, err := os.Readlink(path)
	if err != nil {
		return false
	}

	cleanExpected := filepath.Clean(expectedTarget)
	cleanActual := filepath.Clean(linkTarget)

	return cleanActual == cleanExpected
}

func fileExists(path string) bool {
	_, err := os.Lstat(path)
	return err == nil
}

func copyDir(source, destination string) error {
	if err := os.MkdirAll(destination, 0o755); err != nil {
		return err
	}

	return filepath.WalkDir(source, func(path string, entry fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		relativePath, err := filepath.Rel(source, path)
		if err != nil {
			return err
		}
		if relativePath == "." {
			return nil
		}

		targetPath := filepath.Join(destination, relativePath)
		if entry.IsDir() {
			return os.MkdirAll(targetPath, 0o755)
		}

		data, err := os.ReadFile(path)
		if err != nil {
			return err
		}

		return os.WriteFile(targetPath, data, 0o644)
	})
}

func selectedTargetsFromSet(targets []setupTarget, selectedSet map[string]bool) []setupTarget {
	selected := make([]setupTarget, 0, len(selectedSet))
	for _, target := range targets {
		if selectedSet[target.ID] {
			selected = append(selected, target)
		}
	}

	return selected
}

func parseSelectionCSV(csv string, targets []setupTarget) (map[string]bool, error) {
	valid := make(map[string]struct{}, len(targets))
	for _, target := range targets {
		valid[target.ID] = struct{}{}
	}

	selected := make(map[string]bool)
	for _, token := range strings.Split(csv, ",") {
		id := strings.TrimSpace(token)
		if id == "" {
			continue
		}
		if _, ok := valid[id]; !ok {
			return nil, fmt.Errorf("unknown agent id %q", id)
		}
		selected[id] = true
	}

	if len(selected) == 0 {
		return nil, errors.New("at least one target must be selected")
	}

	return selected, nil
}

const diffxSkillContent = "---\n" +
	"name: diffx\n" +
	"description: Launch Diffx interactive review, receive annotation feedback via stdout, and continue implementation in the same Codex thread.\n" +
	"allowed-tools: Bash(diffx:*)\n" +
	"---\n\n" +
	"# Diffx Review\n\n" +
	"Use this skill when the user wants interactive annotation-based code review with Diffx and expects feedback to return into the current thread.\n\n" +
	"## Workflow\n\n" +
	"1. Run `diffx review` with any explicit arguments provided by the user.\n" +
	"2. Wait for the UI review to be submitted via \"Send to agent\".\n" +
	"3. Read stdout from the command. Diffx exits after feedback is submitted.\n" +
	"4. Route by user intent:\n" +
	"   - If the user is asking a question or asking why something changed, answer directly and do not edit files.\n" +
	"   - Only make code edits when the user explicitly asks for an edit or implementation.\n" +
	"5. If the user explicitly asked for edits and stdout includes requested fixes, implement them now.\n" +
	"6. If stdout says no changes were requested, acknowledge and continue.\n\n" +
	"## Notes\n\n" +
	"- Diffx review mode is one-shot: after feedback submission, the process exits.\n" +
	"- Treat returned review feedback as blocking only when the user explicitly asked for edits.\n"

const diffxClaudeCommandContent = "---\n" +
	"description: Open interactive Diffx review and send annotations back to this chat\n" +
	"argument-hint: [optional diffx review args]\n" +
	"allowed-tools: Bash(diffx:*)\n" +
	"---\n\n" +
	"## Diffx Review\n\n" +
	"!`diffx review $ARGUMENTS`\n\n" +
	"## Your task\n\n" +
	"If the user is asking a question or asking why something changed, answer directly and do not edit files.\n" +
	"Only make code edits when the user explicitly asks for an edit or implementation.\n" +
	"If the user explicitly asks for edits and the review output above contains requested changes, address them in this session.\n"
