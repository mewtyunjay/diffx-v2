package diagnostics

import (
	"log/slog"
	"regexp"
	"strings"
)

var credentialPatterns = []*regexp.Regexp{
	regexp.MustCompile(`(?i)(https?://)[^\s/@]+@`),
	regexp.MustCompile(`(?i)((?:authorization["']?\s*[:=]\s*["']?)(?:basic|bearer)\s+)[^\s"']+`),
	regexp.MustCompile(`(?i)((?:access[_-]?token|refresh[_-]?token|api[_-]?key|password|client[_-]?secret|token)["']?\s*[:=]\s*["']?)[^\s&"']+`),
	regexp.MustCompile(`()(?:gh[pousr]_[A-Za-z0-9_]+|github_pat_[A-Za-z0-9_]+|sk-(?:proj-|ant-)?[A-Za-z0-9_-]{12,})`),
}

func scrubLogAttr(_ []string, attr slog.Attr) slog.Attr {
	var text string
	switch value := attr.Value.Any().(type) {
	case string:
		text = value
	case error:
		text = value.Error()
	default:
		return attr
	}

	for _, pattern := range credentialPatterns {
		text = pattern.ReplaceAllString(text, "${1}[redacted]")
	}
	if len(text) > 2048 {
		text = strings.ToValidUTF8(text[:2045], "") + "..."
	}
	return slog.String(attr.Key, text)
}
