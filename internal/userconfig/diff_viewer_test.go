package userconfig

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func TestStoreSaveDiffViewerPreferencesPreservesUnknownKeys(t *testing.T) {
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
		},
		"ui": map[string]any{
			"accent": "blue",
		},
	}

	payload, err := json.Marshal(existing)
	if err != nil {
		t.Fatalf("marshal existing: %v", err)
	}
	if err := os.WriteFile(configPath, payload, 0o644); err != nil {
		t.Fatalf("write existing: %v", err)
	}

	store := NewStore(homeDir)
	if _, err := store.SaveDiffViewerPreferences(DiffViewerPreferences{
		ViewMode:       DiffViewModeUnified,
		DiffDetailMode: DiffDetailModeFullFile,
	}); err != nil {
		t.Fatalf("SaveDiffViewerPreferences returned error: %v", err)
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
	if _, ok := decoded["ai"].(map[string]any); !ok {
		t.Fatalf("expected ai map to be preserved, got %#v", decoded["ai"])
	}

	uiMap, ok := decoded["ui"].(map[string]any)
	if !ok {
		t.Fatalf("expected ui map, got %#v", decoded["ui"])
	}
	if uiMap["accent"] != "blue" {
		t.Fatalf("expected unknown ui key to be preserved, got %#v", uiMap)
	}

	diffViewerMap, ok := uiMap["diffViewer"].(map[string]any)
	if !ok {
		t.Fatalf("expected diffViewer map, got %#v", uiMap["diffViewer"])
	}
	if diffViewerMap["viewMode"] != DiffViewModeUnified {
		t.Fatalf("expected unified view mode, got %#v", diffViewerMap["viewMode"])
	}
	if diffViewerMap["diffDetailMode"] != DiffDetailModeFullFile {
		t.Fatalf("expected full file detail mode, got %#v", diffViewerMap["diffDetailMode"])
	}
}

func TestStoreLoadDiffViewerPreferencesNormalizesInvalidValues(t *testing.T) {
	t.Parallel()

	homeDir := t.TempDir()
	configPath := filepath.Join(homeDir, ".diffx", "config.json")
	if err := os.MkdirAll(filepath.Dir(configPath), 0o755); err != nil {
		t.Fatalf("mkdir config dir: %v", err)
	}

	payload := []byte(`{"ui":{"diffViewer":{"viewMode":"sideways","diffDetailMode":"everything"}}}`)
	if err := os.WriteFile(configPath, payload, 0o644); err != nil {
		t.Fatalf("write config: %v", err)
	}

	preferences, err := NewStore(homeDir).LoadDiffViewerPreferences()
	if err != nil {
		t.Fatalf("LoadDiffViewerPreferences returned error: %v", err)
	}

	if preferences != DefaultDiffViewerPreferences() {
		t.Fatalf("expected defaults for invalid values, got %#v", preferences)
	}
}
