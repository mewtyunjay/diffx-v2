package gitstatus

import "log/slog"

var emptyContentHash = hashContents(nil)

func NewService(repoRoot, scopePath string, loggers ...*slog.Logger) *Service {
	var logger *slog.Logger
	if len(loggers) > 0 {
		logger = loggers[0]
	}
	return &Service{
		logger:       logger,
		repoRoot:     repoRoot,
		scopePath:    normalizeScopePath(scopePath),
		versionCache: newVersionCache(versionCacheLimit),
	}
}

func (s *Service) ScopePath() string {
	return s.scopePath
}
