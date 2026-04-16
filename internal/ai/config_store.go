package ai

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
)

const configVersion = 1

type configStore struct {
	configPath string
}

func newConfigStore(homeDir string) configStore {
	return configStore{
		configPath: filepath.Join(homeDir, ".diffx", "config.json"),
	}
}

func (store configStore) LoadFeatureProviders() (FeatureProviders, error) {
	root, _, err := store.loadRootMap()
	if err != nil {
		return FeatureProviders{}, err
	}

	providers := FeatureProviders{}
	aiMap, _ := asMap(root["ai"])
	featuresMap, _ := asMap(aiMap["features"])

	providers.CommitMessage = normalizeProviderID(toProviderID(featuresMap[string(FeatureCommitMessage)]))

	return providers, nil
}

func (store configStore) SaveFeatureProviders(providers FeatureProviders) error {
	providers.Normalize()

	root, _, err := store.loadRootMap()
	if err != nil {
		return err
	}

	aiMap, _ := asMap(root["ai"])
	if aiMap == nil {
		aiMap = make(map[string]any)
	}

	features := map[string]any{
		string(FeatureCommitMessage): string(providers.CommitMessage),
	}

	aiMap["features"] = features
	root["ai"] = aiMap
	root["configVersion"] = configVersion

	if err := os.MkdirAll(filepath.Dir(store.configPath), 0o755); err != nil {
		return fmt.Errorf("create config directory: %w", err)
	}

	payload, err := json.MarshalIndent(root, "", "  ")
	if err != nil {
		return fmt.Errorf("encode config JSON: %w", err)
	}

	payload = append(payload, '\n')
	if err := os.WriteFile(store.configPath, payload, 0o644); err != nil {
		return fmt.Errorf("write config JSON: %w", err)
	}

	return nil
}

func (store configStore) loadRootMap() (map[string]any, bool, error) {
	data, err := os.ReadFile(store.configPath)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return map[string]any{}, false, nil
		}

		return nil, false, fmt.Errorf("read settings file: %w", err)
	}

	if len(data) == 0 {
		return map[string]any{}, true, nil
	}

	root := make(map[string]any)
	if err := json.Unmarshal(data, &root); err != nil {
		return nil, true, fmt.Errorf("decode settings file: %w", err)
	}

	return root, true, nil
}

func asMap(value any) (map[string]any, bool) {
	if value == nil {
		return nil, false
	}

	mapValue, ok := value.(map[string]any)
	return mapValue, ok
}

func toProviderID(value any) ProviderID {
	stringValue, ok := value.(string)
	if !ok {
		return ""
	}

	return ProviderID(stringValue)
}
