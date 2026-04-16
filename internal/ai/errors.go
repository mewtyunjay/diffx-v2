package ai

import "fmt"

type FeatureProviderValidationError struct {
	Feature  FeatureID
	Provider ProviderID
	Reason   string
}

func (err *FeatureProviderValidationError) Error() string {
	if err.Provider == "" {
		return fmt.Sprintf("%s provider is required", err.Feature)
	}
	if err.Reason == "" {
		return fmt.Sprintf("%s provider %q is not selectable", err.Feature, err.Provider)
	}

	return fmt.Sprintf("%s provider %q is not selectable: %s", err.Feature, err.Provider, err.Reason)
}

type HiddenScopedStagedChangesError struct {
	HiddenCount int
}

func (err *HiddenScopedStagedChangesError) Error() string {
	if err.HiddenCount == 1 {
		return "1 staged file exists outside the current workspace scope"
	}

	return fmt.Sprintf("%d staged files exist outside the current workspace scope", err.HiddenCount)
}

type NoStagedChangesInScopeError struct{}

func (err *NoStagedChangesInScopeError) Error() string {
	return "no staged changes available in the current workspace scope"
}

type FeatureProviderNotConfiguredError struct {
	Feature FeatureID
}

func (err *FeatureProviderNotConfiguredError) Error() string {
	return fmt.Sprintf("%s provider is not configured", err.Feature)
}
