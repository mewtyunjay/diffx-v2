package ai

import "strings"

type ProviderID string

const (
	ProviderCodex  ProviderID = "codex"
	ProviderClaude ProviderID = "claude"
)

type FeatureID string

const (
	FeatureCommitMessage FeatureID = "commitMessage"
)

var allFeatures = []FeatureID{
	FeatureCommitMessage,
}

var allProviders = []ProviderID{
	ProviderCodex,
	ProviderClaude,
}

type FeatureProviders struct {
	CommitMessage ProviderID `json:"commitMessage"`
}

func (value FeatureProviders) ProviderForFeature(feature FeatureID) ProviderID {
	switch feature {
	case FeatureCommitMessage:
		return value.CommitMessage
	default:
		return ""
	}
}

func (value *FeatureProviders) SetProvider(feature FeatureID, provider ProviderID) {
	switch feature {
	case FeatureCommitMessage:
		value.CommitMessage = provider
	}
}

func (value *FeatureProviders) Normalize() {
	value.CommitMessage = normalizeProviderID(value.CommitMessage)
}

func normalizeProviderID(provider ProviderID) ProviderID {
	normalized := ProviderID(strings.TrimSpace(strings.ToLower(string(provider))))
	for _, candidate := range allProviders {
		if normalized == candidate {
			return normalized
		}
	}

	return ""
}

type AgentStatus struct {
	ID              ProviderID `json:"id"`
	Label           string     `json:"label"`
	BinaryPath      string     `json:"binaryPath,omitempty"`
	Available       bool       `json:"available"`
	HeadlessCapable bool       `json:"headlessCapable"`
	Selectable      bool       `json:"selectable"`
	Checking        bool       `json:"checking"`
	Reason          string     `json:"reason,omitempty"`
}

type FeatureState struct {
	FeatureID         FeatureID  `json:"featureId"`
	Provider          ProviderID `json:"provider"`
	ProviderValid     bool       `json:"providerValid"`
	SuggestedProvider ProviderID `json:"suggestedProvider,omitempty"`
}

type SettingsResponse struct {
	Features         FeatureProviders `json:"features"`
	FeatureStates    []FeatureState   `json:"featureStates"`
	Agents           []AgentStatus    `json:"agents"`
	IsCheckingAgents bool             `json:"isCheckingAgents"`
}

type CommitMessageSuggestion struct {
	Provider ProviderID `json:"provider"`
	Message  string     `json:"message"`
}
