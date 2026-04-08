package gitstatus

import (
	"path/filepath"
	"strings"
)

func detectLanguage(path string) string {
	if path == "" {
		return "text"
	}

	base := filepath.Base(path)
	if language, ok := languageByBaseName[base]; ok {
		return language
	}

	if language, ok := languageByExtension[strings.ToLower(filepath.Ext(base))]; ok {
		return language
	}

	return "text"
}

var languageByBaseName = map[string]string{
	"Dockerfile":        "docker",
	"README":            "md",
	"README.md":         "md",
	"go.mod":            "go",
	"go.sum":            "go",
	"package.json":      "json",
	"package-lock.json": "json",
}

var languageByExtension = map[string]string{
	".bash": "bash",
	".css":  "css",
	".go":   "go",
	".html": "html",
	".java": "java",
	".js":   "js",
	".json": "json",
	".jsx":  "jsx",
	".md":   "md",
	".mjs":  "js",
	".py":   "python",
	".rb":   "ruby",
	".rs":   "rust",
	".sh":   "bash",
	".sql":  "sql",
	".toml": "toml",
	".ts":   "ts",
	".tsx":  "tsx",
	".txt":  "text",
	".xml":  "xml",
	".yaml": "yaml",
	".yml":  "yaml",
	".zsh":  "bash",
}
