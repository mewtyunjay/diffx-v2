package userconfig

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
)

const configVersion = 1

type Store struct {
	ConfigPath string
}

func NewStore(homeDir string) Store {
	return Store{
		ConfigPath: filepath.Join(homeDir, ".diffx", "config.json"),
	}
}

func NewDefaultStore() (Store, error) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return Store{}, fmt.Errorf("resolve home directory: %w", err)
	}

	return NewStore(homeDir), nil
}

func (store Store) LoadRootMap() (map[string]any, error) {
	data, err := os.ReadFile(store.ConfigPath)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return map[string]any{}, nil
		}

		return nil, fmt.Errorf("read settings file: %w", err)
	}

	if len(data) == 0 {
		return map[string]any{}, nil
	}

	root := make(map[string]any)
	if err := json.Unmarshal(data, &root); err != nil {
		return nil, fmt.Errorf("decode settings file: %w", err)
	}

	return root, nil
}

func (store Store) SaveRootMap(root map[string]any) error {
	root["configVersion"] = configVersion

	if err := os.MkdirAll(filepath.Dir(store.ConfigPath), 0o755); err != nil {
		return fmt.Errorf("create config directory: %w", err)
	}

	payload, err := json.MarshalIndent(root, "", "  ")
	if err != nil {
		return fmt.Errorf("encode config JSON: %w", err)
	}

	payload = append(payload, '\n')
	if err := os.WriteFile(store.ConfigPath, payload, 0o644); err != nil {
		return fmt.Errorf("write config JSON: %w", err)
	}

	return nil
}

func AsMap(value any) (map[string]any, bool) {
	if value == nil {
		return nil, false
	}

	mapValue, ok := value.(map[string]any)
	return mapValue, ok
}
