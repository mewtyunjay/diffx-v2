package main

import (
	"bytes"
	"strings"
	"testing"
)

func TestParseSelectionCSV(t *testing.T) {
	t.Parallel()

	targets := []setupTarget{
		{ID: "universal"},
		{ID: "claude"},
		{ID: "codex"},
	}

	selected, err := parseSelectionCSV(" universal,claude ,codex ", targets)
	if err != nil {
		t.Fatalf("parseSelectionCSV returned error: %v", err)
	}

	if len(selected) != 3 {
		t.Fatalf("parseSelectionCSV selected %d targets, want 3", len(selected))
	}
	if !selected["universal"] || !selected["claude"] || !selected["codex"] {
		t.Fatalf("unexpected selected targets: %#v", selected)
	}
}

func TestParseSelectionCSVUnknownID(t *testing.T) {
	t.Parallel()

	targets := []setupTarget{
		{ID: "universal"},
		{ID: "claude"},
	}

	if _, err := parseSelectionCSV("universal,unknown", targets); err == nil {
		t.Fatal("expected error for unknown id")
	}
}

func TestParseSelectionCSVEmptySelection(t *testing.T) {
	t.Parallel()

	targets := []setupTarget{
		{ID: "universal"},
	}

	if _, err := parseSelectionCSV("  ,  ", targets); err == nil {
		t.Fatal("expected error for empty selection")
	}
}

func TestRunSetupListAgents(t *testing.T) {
	t.Parallel()

	stdout := &bytes.Buffer{}
	stderr := &bytes.Buffer{}
	if err := run([]string{"setup", "--list-agents"}, stdout, stderr); err != nil {
		t.Fatalf("run returned error: %v", err)
	}

	output := stdout.String()
	if !strings.Contains(output, "Available agent targets:") {
		t.Fatalf("expected list header in output, got: %q", output)
	}
	if !strings.Contains(output, "universal") || !strings.Contains(output, "claude") {
		t.Fatalf("expected default targets in output, got: %q", output)
	}
}
