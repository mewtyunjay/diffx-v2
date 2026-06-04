package gitstatus

var emptyContentHash = hashContents(nil)

func NewService(repoRoot, scopePath string) *Service {
	return &Service{
		repoRoot:     repoRoot,
		scopePath:    normalizeScopePath(scopePath),
		versionCache: newVersionCache(versionCacheLimit),
	}
}

func (s *Service) ScopePath() string {
	return s.scopePath
}
