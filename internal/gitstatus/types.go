package gitstatus

import "sync"

type ChangedFileStatus string

const (
	StatusAdded    ChangedFileStatus = "added"
	StatusModified ChangedFileStatus = "modified"
	StatusDeleted  ChangedFileStatus = "deleted"
	StatusRenamed  ChangedFileStatus = "renamed"

	maxDiffFileBytes  = 256 * 1024
	versionCacheLimit = 256
)

type ChangedFileItem struct {
	ID                 string            `json:"id"`
	Path               string            `json:"path"`
	DisplayPath        string            `json:"displayPath"`
	PreviousPath       string            `json:"previousPath,omitempty"`
	Status             ChangedFileStatus `json:"status"`
	IsTracked          bool              `json:"isTracked"`
	HasStagedChanges   bool              `json:"hasStagedChanges"`
	HasUnstagedChanges bool              `json:"hasUnstagedChanges"`
	ContentKey         string            `json:"contentKey"`
	Language           string            `json:"language,omitempty"`
}

type ChangedFilesResult struct {
	Mode                  ComparisonMode    `json:"mode"`
	BaseRef               string            `json:"baseRef"`
	BaseCommit            string            `json:"baseCommit"`
	CurrentRef            string            `json:"currentRef"`
	CurrentCommit         string            `json:"currentCommit"`
	UpstreamRef           string            `json:"upstreamRef,omitempty"`
	RepoName              string            `json:"repoName"`
	WorkspaceName         string            `json:"workspaceName"`
	ScopePath             string            `json:"scopePath"`
	HiddenStagedFileCount int               `json:"hiddenStagedFileCount"`
	Files                 []ChangedFileItem `json:"files"`
	InitialDiff           *FileDiffResult   `json:"initialDiff,omitempty"`
}

type FileVersion struct {
	Name     string `json:"name"`
	Contents string `json:"contents"`
	CacheKey string `json:"cacheKey"`
}

type FileDiffResult struct {
	Mode          ComparisonMode    `json:"mode"`
	BaseRef       string            `json:"baseRef"`
	BaseCommit    string            `json:"baseCommit"`
	CurrentRef    string            `json:"currentRef"`
	CurrentCommit string            `json:"currentCommit"`
	Path          string            `json:"path"`
	PreviousPath  string            `json:"previousPath,omitempty"`
	Status        ChangedFileStatus `json:"status"`
	Language      string            `json:"language,omitempty"`
	Before        FileVersion       `json:"before"`
	After         FileVersion       `json:"after"`
	Binary        bool              `json:"binary,omitempty"`
	TooLarge      bool              `json:"tooLarge,omitempty"`
}

type Service struct {
	repoRoot     string
	scopePath    string
	versionCache *versionCache
}

type cachedFileVersion struct {
	version  FileVersion
	binary   bool
	tooLarge bool
}

type versionCache struct {
	mu         sync.Mutex
	maxEntries int
	order      []string
	items      map[string]cachedFileVersion
}
