package ai

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func TestConfigStoreSaveFeatureProvidersPreservesUnknownKeys(t *testing.T) {
	t.Parallel()

	homeDir := t.TempDir()
	configPath := filepath.Join(homeDir, ".diffx", "config.json")
	if err := os.MkdirAll(filepath.Dir(configPath), 0o755); err != nil {
		t.Fatalf("mkdir config dir: %v", err)
	}

	existing := map[string]any{
		"configVersion": 99,
		"theme":         "quiet",
		"ai": map[string]any{
			"features": map[string]any{
				"commitMessage": "codex",
			},
			"experiments": map[string]any{"foo": true},
		},
	}

	payload, err := json.Marshal(existing)
	if err != nil {
		t.Fatalf("marshal existing: %v", err)
	}
	if err := os.WriteFile(configPath, payload, 0o644); err != nil {
		t.Fatalf("write existing: %v", err)
	}

	store := newConfigStore(homeDir)
	if err := store.SaveFeatureProviders(FeatureProviders{
		CommitMessage: ProviderCodex,
	}); err != nil {
		t.Fatalf("SaveFeatureProviders returned error: %v", err)
	}

	saved, err := os.ReadFile(configPath)
	if err != nil {
		t.Fatalf("read saved config: %v", err)
	}

	var decoded map[string]any
	if err := json.Unmarshal(saved, &decoded); err != nil {
		t.Fatalf("decode saved config: %v", err)
	}

	if decoded["theme"] != "quiet" {
		t.Fatalf("expected top-level unknown key to be preserved, got %#v", decoded["theme"])
	}

	aiMap, ok := decoded["ai"].(map[string]any)
	if !ok {
		t.Fatalf("expected ai map, got %#v", decoded["ai"])
	}

	if _, ok := aiMap["experiments"]; !ok {
		t.Fatalf("expected unknown ai key to be preserved, got %#v", aiMap)
	}

	featuresMap, ok := aiMap["features"].(map[string]any)
	if !ok {
		t.Fatalf("expected features map, got %#v", aiMap["features"])
	}

	if got := featuresMap[string(FeatureCommitMessage)]; got != string(ProviderCodex) {
		t.Fatalf("expected commit message provider codex, got %#v", got)
	}
}
