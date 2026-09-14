package main

import (
	"bytes"
	"testing"
)

func TestParseReleaseTag(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		input   string
		want    string
		wantErr bool
	}{
		{name: "slash format", input: "0/1/2", want: "v0.1.2"},
		{name: "slash format with v prefix", input: "v1/4/0", want: "v1.4.0"},
		{name: "dot format", input: "2.3.4", want: "v2.3.4"},
		{name: "dot format with v prefix", input: "v3.0.1", want: "v3.0.1"},
		{name: "invalid component count", input: "1/2", wantErr: true},
		{name: "invalid component non numeric", input: "1/x/3", wantErr: true},
		{name: "invalid delimiter", input: "1-2-3", wantErr: true},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got, err := parseReleaseTag(tt.input)
			if tt.wantErr {
				if err == nil {
					t.Fatalf("expected error for input %q", tt.input)
				}
				return
			}

			if err != nil {
				t.Fatalf("parseReleaseTag returned error: %v", err)
			}
			if got != tt.want {
				t.Fatalf("parseReleaseTag(%q) = %q, want %q", tt.input, got, tt.want)
			}
		})
	}
}

func TestParseReleaseConfig(t *testing.T) {
	t.Parallel()

	stderr := &bytes.Buffer{}
	cfg, version, err := parseReleaseConfig([]string{"1/2/3", "--yes", "--remote", "upstream", "--dry-run"}, stderr)
	if err != nil {
		t.Fatalf("parseReleaseConfig returned error: %v", err)
	}
	if version != "1/2/3" {
		t.Fatalf("parseReleaseConfig version = %q, want %q", version, "1/2/3")
	}
	if !cfg.yes || !cfg.dryRun {
		t.Fatalf("parseReleaseConfig flags not parsed as expected: %#v", cfg)
	}
	if cfg.remote != "upstream" {
		t.Fatalf("parseReleaseConfig remote = %q, want %q", cfg.remote, "upstream")
	}
}

func TestParseReleaseConfigRequiresVersion(t *testing.T) {
	t.Parallel()

	if _, _, err := parseReleaseConfig([]string{}, &bytes.Buffer{}); err == nil {
		t.Fatal("expected error when version argument is missing")
	}
}

func TestNextTagForBump(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		tags []string
		bump string
		want string
	}{
		{
			name: "patch bump from latest",
			tags: []string{"v0.1.0", "v0.1.2", "v0.1.1"},
			bump: "patch",
			want: "v0.1.3",
		},
		{
			name: "minor bump resets patch",
			tags: []string{"v1.4.9"},
			bump: "minor",
			want: "v1.5.0",
		},
		{
			name: "major bump resets minor and patch",
			tags: []string{"v2.9.3"},
			bump: "major",
			want: "v3.0.0",
		},
		{
			name: "no tags patch starts at 0.0.1",
			tags: nil,
			bump: "patch",
			want: "v0.0.1",
		},
		{
			name: "no tags minor starts at 0.1.0",
			tags: nil,
			bump: "minor",
			want: "v0.1.0",
		},
		{
			name: "no tags major starts at 1.0.0",
			tags: nil,
			bump: "major",
			want: "v1.0.0",
		},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got, err := nextTagForBump(tt.tags, tt.bump)
			if err != nil {
				t.Fatalf("nextTagForBump returned error: %v", err)
			}
			if got != tt.want {
				t.Fatalf("nextTagForBump(tags=%v, bump=%q) = %q, want %q", tt.tags, tt.bump, got, tt.want)
			}
		})
	}
}
