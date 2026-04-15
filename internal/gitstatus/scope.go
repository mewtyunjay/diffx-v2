package gitstatus

import (
	"path/filepath"
	"strings"
)

func normalizeScopePath(scopePath string) string {
	if scopePath == "" {
		return "."
	}

	normalized := filepath.ToSlash(filepath.Clean(scopePath))
	normalized = strings.TrimPrefix(normalized, "./")
	if normalized == "" {
		return "."
	}

	return normalized
}

func matchesScope(path, scopePath string) bool {
	if path == "" {
		return false
	}

	normalizedScope := normalizeScopePath(scopePath)
	if normalizedScope == "." {
		return true
	}

	normalizedPath := filepath.ToSlash(filepath.Clean(path))
	normalizedPath = strings.TrimPrefix(normalizedPath, "./")

	return normalizedPath == normalizedScope || strings.HasPrefix(normalizedPath, normalizedScope+"/")
}

func workspaceNameForScope(repoRoot, scopePath string) string {
	normalizedScope := normalizeScopePath(scopePath)
	if normalizedScope == "." {
		return filepath.Base(repoRoot)
	}

	return filepath.Base(normalizedScope)
}

func displayPathForScope(path, previousPath, scopePath string) string {
	normalizedScope := normalizeScopePath(scopePath)
	normalizedPath := filepath.ToSlash(filepath.Clean(path))
	if normalizedScope == "." {
		return normalizedPath
	}

	displayTarget := normalizedPath
	if !matchesScope(normalizedPath, normalizedScope) && matchesScope(previousPath, normalizedScope) {
		displayTarget = filepath.ToSlash(filepath.Clean(previousPath))
	}

	relativePath, err := filepath.Rel(normalizedScope, displayTarget)
	if err != nil {
		return displayTarget
	}

	return filepath.ToSlash(relativePath)
}

func (status ChangedFileStatus) IsValid() bool {
	switch status {
	case StatusAdded, StatusModified, StatusDeleted, StatusRenamed, StatusConflicted:
		return true
	default:
		return false
	}
}
