package ai

import (
	"diffx/internal/userconfig"
)

type configStore struct {
	store userconfig.Store
}

func newConfigStore(homeDir string) configStore {
	return configStore{
		store: userconfig.NewStore(homeDir),
	}
}

func (store configStore) LoadFeatureProviders() (FeatureProviders, error) {
	root, err := store.store.LoadRootMap()
	if err != nil {
		return FeatureProviders{}, err
	}

	providers := FeatureProviders{}
	aiMap, _ := userconfig.AsMap(root["ai"])
	featuresMap, _ := userconfig.AsMap(aiMap["features"])

	providers.CommitMessage = normalizeProviderID(toProviderID(featuresMap[string(FeatureCommitMessage)]))

	return providers, nil
}

func (store configStore) SaveFeatureProviders(providers FeatureProviders) error {
	providers.Normalize()

	root, err := store.store.LoadRootMap()
	if err != nil {
		return err
	}

	aiMap, _ := userconfig.AsMap(root["ai"])
	if aiMap == nil {
		aiMap = make(map[string]any)
	}

	features := map[string]any{
		string(FeatureCommitMessage): string(providers.CommitMessage),
	}

	aiMap["features"] = features
	root["ai"] = aiMap

	return store.store.SaveRootMap(root)
}

func toProviderID(value any) ProviderID {
	stringValue, ok := value.(string)
	if !ok {
		return ""
	}

	return ProviderID(stringValue)
}
