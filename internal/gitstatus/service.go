package gitstatus

import (
	"bytes"
	"context"
	"crypto/sha1"
	"encoding/hex"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
)

type ChangedFileStatus string

const (
	StatusAdded    ChangedFileStatus = "added"
	StatusModified ChangedFileStatus = "modified"
	StatusDeleted  ChangedFileStatus = "deleted"
	StatusRenamed  ChangedFileStatus = "renamed"

	maxDiffFileBytes  = 256 * 1024
	versionCacheLimit = 256
)

var emptyContentHash = hashContents(nil)

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

func NewService(repoRoot, scopePath string) *Service {
	return &Service{
		repoRoot:     repoRoot,
		scopePath:    normalizeScopePath(scopePath),
		versionCache: newVersionCache(versionCacheLimit),
	}
}

func newVersionCache(maxEntries int) *versionCache {
	return &versionCache{
		maxEntries: maxEntries,
		items:      make(map[string]cachedFileVersion, maxEntries),
	}
}

func (c *versionCache) Get(key string) (cachedFileVersion, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()

	value, ok := c.items[key]
	if !ok {
		return cachedFileVersion{}, false
	}

	c.touch(key)

	return value, true
}

func (c *versionCache) Set(key string, value cachedFileVersion) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if _, ok := c.items[key]; ok {
		c.items[key] = value
		c.touch(key)
		return
	}

	c.items[key] = value
	c.order = append(c.order, key)

	if len(c.order) <= c.maxEntries {
		return
	}

	evicted := c.order[0]
	c.order = c.order[1:]
	delete(c.items, evicted)
}

func (c *versionCache) touch(key string) {
	for index, existing := range c.order {
		if existing != key {
			continue
		}

		c.order = append(c.order[:index], c.order[index+1:]...)
		break
	}

	c.order = append(c.order, key)
}

func (s *Service) HeadCommit(ctx context.Context) (string, error) {
	cmd := exec.CommandContext(ctx, "git", "-C", s.repoRoot, "rev-parse", "HEAD")
	output, err := cmd.Output()
	if err != nil {
		return "", fmt.Errorf("git rev-parse HEAD: %w", err)
	}

	return strings.TrimSpace(string(output)), nil
}

func (s *Service) AllowsDiff(path, previousPath string) bool {
	return matchesScope(path, s.scopePath) || matchesScope(previousPath, s.scopePath)
}

func (s *Service) ListChangedFiles(ctx context.Context, baseRef string) (ChangedFilesResult, error) {
	comparison, err := s.resolveComparison(ctx, baseRef)
	if err != nil {
		return ChangedFilesResult{}, err
	}

	statusFiles, err := s.listStatusFiles(ctx)
	if err != nil {
		return ChangedFilesResult{}, err
	}

	upstreamRef, err := s.CurrentUpstreamRef(ctx)
	if err != nil {
		return ChangedFilesResult{}, err
	}

	var files []ChangedFileItem
	switch comparison.Mode {
	case ComparisonModeBranch:
		files, err = s.listFilesAgainstBase(ctx, comparison.BaseRef, statusFiles)
	default:
		files = statusFiles
	}
	if err != nil {
		return ChangedFilesResult{}, err
	}

	filteredFiles := make([]ChangedFileItem, 0, len(files))
	for _, file := range files {
		if s.AllowsDiff(file.Path, file.PreviousPath) {
			file.DisplayPath = displayPathForScope(file.Path, file.PreviousPath, s.scopePath)
			filteredFiles = append(filteredFiles, file)
		}
	}

	hiddenStagedFileCount := 0
	for _, file := range statusFiles {
		if file.HasStagedChanges && !s.AllowsDiff(file.Path, file.PreviousPath) {
			hiddenStagedFileCount++
		}
	}

	var initialDiff *FileDiffResult
	if len(filteredFiles) > 0 {
		diff, err := s.readFileDiffWithComparison(
			ctx,
			comparison,
			filteredFiles[0].Path,
			filteredFiles[0].Status,
			filteredFiles[0].PreviousPath,
		)
		if err != nil {
			return ChangedFilesResult{}, err
		}

		initialDiff = &diff
	}

	return ChangedFilesResult{
		Mode:                  comparison.Mode,
		BaseRef:               comparison.BaseRef,
		BaseCommit:            comparison.BaseCommit,
		CurrentRef:            comparison.CurrentRef,
		CurrentCommit:         comparison.CurrentCommit,
		UpstreamRef:           upstreamRef,
		WorkspaceName:         workspaceNameForScope(s.repoRoot, s.scopePath),
		ScopePath:             s.scopePath,
		HiddenStagedFileCount: hiddenStagedFileCount,
		Files:                 filteredFiles,
		InitialDiff:           initialDiff,
	}, nil
}

func parsePorcelainStatus(output []byte, repoRoot string) ([]ChangedFileItem, error) {
	if len(output) == 0 {
		return []ChangedFileItem{}, nil
	}

	tokens := bytes.Split(output, []byte{0})
	files := make([]ChangedFileItem, 0, len(tokens))

	for index := 0; index < len(tokens); index++ {
		token := tokens[index]
		if len(token) == 0 {
			continue
		}
		if len(token) < 4 {
			return nil, fmt.Errorf("invalid status token %q", string(token))
		}

		code := string(token[:2])
		path := string(token[3:])
		if path == "" {
			return nil, fmt.Errorf("missing path for status token %q", string(token))
		}

		previousPath := ""
		if code[0] == 'R' || code[1] == 'R' {
			if index+1 < len(tokens) && len(tokens[index+1]) > 0 {
				previousPath = string(tokens[index+1])
				index++
			}
		}

		item := ChangedFileItem{
			ID:                 path,
			Path:               path,
			PreviousPath:       previousPath,
			Status:             mapChangedStatus(code),
			IsTracked:          code != "??",
			HasStagedChanges:   code[0] != ' ' && code[0] != '?',
			HasUnstagedChanges: code == "??" || (code[1] != ' ' && code[1] != '?'),
			ContentKey:         "missing",
			Language:           detectLanguage(path),
		}

		if key, err := buildContentKey(repoRoot, path); err == nil {
			item.ContentKey = key
		} else if !errors.Is(err, fs.ErrNotExist) {
			return nil, err
		}

		files = append(files, item)
	}

	return files, nil
}

func mapChangedStatus(code string) ChangedFileStatus {
	switch {
	case code == "??":
		return StatusAdded
	case strings.Contains(code, "R"):
		return StatusRenamed
	case strings.Contains(code, "D"):
		return StatusDeleted
	case strings.Contains(code, "A"):
		return StatusAdded
	default:
		return StatusModified
	}
}

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
	case StatusAdded, StatusModified, StatusDeleted, StatusRenamed:
		return true
	default:
		return false
	}
}

func buildContentKey(repoRoot, relPath string) (string, error) {
	absPath, err := ResolveRepoPath(repoRoot, relPath)
	if err != nil {
		return "", err
	}

	info, err := os.Stat(absPath)
	if err != nil {
		return "", err
	}

	return fmt.Sprintf("%d-%d", info.Size(), info.ModTime().UnixNano()), nil
}

func ResolveRepoPath(repoRoot, relPath string) (string, error) {
	cleanPath := filepath.Clean(relPath)
	if cleanPath == "." || cleanPath == "" {
		return "", fmt.Errorf("path is required")
	}
	if filepath.IsAbs(cleanPath) {
		return "", fmt.Errorf("absolute paths are not allowed")
	}

	absPath := filepath.Join(repoRoot, cleanPath)
	absPath, err := filepath.Abs(absPath)
	if err != nil {
		return "", fmt.Errorf("resolve path: %w", err)
	}

	relToRoot, err := filepath.Rel(repoRoot, absPath)
	if err != nil {
		return "", fmt.Errorf("resolve path: %w", err)
	}
	if relToRoot == ".." || strings.HasPrefix(relToRoot, ".."+string(filepath.Separator)) {
		return "", fmt.Errorf("path %q escapes repo root", relPath)
	}

	return absPath, nil
}

func (s *Service) ReadFileContent(relPath string) (string, string, error) {
	result, err := s.readWorkingTreeVersion(relPath)
	if err != nil {
		return "", "", err
	}

	return result.version.Contents, result.version.CacheKey, nil
}

func (s *Service) ReadFileDiff(
	ctx context.Context,
	path string,
	status ChangedFileStatus,
	previousPath string,
	baseRef string,
) (FileDiffResult, error) {
	if path == "" {
		return FileDiffResult{}, fmt.Errorf("path is required")
	}
	if !status.IsValid() {
		return FileDiffResult{}, fmt.Errorf("invalid status %q", status)
	}

	comparison, err := s.resolveComparison(ctx, baseRef)
	if err != nil {
		return FileDiffResult{}, err
	}

	return s.readFileDiffWithComparison(ctx, comparison, path, status, previousPath)
}

func (s *Service) readFileDiffWithComparison(
	ctx context.Context,
	comparison comparisonInfo,
	path string,
	status ChangedFileStatus,
	previousPath string,
) (FileDiffResult, error) {
	if path == "" {
		return FileDiffResult{}, fmt.Errorf("path is required")
	}
	if !status.IsValid() {
		return FileDiffResult{}, fmt.Errorf("invalid status %q", status)
	}

	beforeName := path
	if previousPath != "" {
		beforeName = previousPath
	}

	result := FileDiffResult{
		Mode:          comparison.Mode,
		BaseRef:       comparison.BaseRef,
		BaseCommit:    comparison.BaseCommit,
		CurrentRef:    comparison.CurrentRef,
		CurrentCommit: comparison.CurrentCommit,
		Path:          path,
		PreviousPath:  previousPath,
		Status:        status,
		Language:      detectLanguage(path),
		Before:        emptyFileVersion(beforeName),
		After:         emptyFileVersion(path),
	}

	var beforeResult cachedFileVersion
	var afterResult cachedFileVersion
	var err error

	switch status {
	case StatusAdded:
		afterResult, err = s.readWorkingTreeVersion(path)
		if err != nil {
			return FileDiffResult{}, err
		}
		result.After = afterResult.version
	case StatusDeleted:
		beforeResult, err = s.readGitVersion(ctx, comparison.BaseCommit, path)
		if err != nil {
			return FileDiffResult{}, err
		}
		result.Before = beforeResult.version
	case StatusRenamed:
		beforePath := previousPath
		if beforePath == "" {
			beforePath = path
			result.PreviousPath = beforePath
		}

		beforeResult, err = s.readGitVersion(ctx, comparison.BaseCommit, beforePath)
		if err != nil {
			return FileDiffResult{}, err
		}
		afterResult, err = s.readWorkingTreeVersion(path)
		if err != nil {
			return FileDiffResult{}, err
		}

		result.Before = beforeResult.version
		result.After = afterResult.version
	default:
		beforeResult, err = s.readGitVersion(ctx, comparison.BaseCommit, path)
		if err != nil {
			return FileDiffResult{}, err
		}
		afterResult, err = s.readWorkingTreeVersion(path)
		if err != nil {
			return FileDiffResult{}, err
		}

		result.Before = beforeResult.version
		result.After = afterResult.version
	}

	result.Binary = beforeResult.binary || afterResult.binary
	result.TooLarge = beforeResult.tooLarge || afterResult.tooLarge

	return result, nil
}

func (s *Service) readWorkingTreeVersion(relPath string) (cachedFileVersion, error) {
	absPath, err := ResolveRepoPath(s.repoRoot, relPath)
	if err != nil {
		return cachedFileVersion{}, err
	}

	info, err := os.Stat(absPath)
	if err != nil {
		return cachedFileVersion{}, err
	}

	cacheKey := fmt.Sprintf(
		"worktree:%s:%d-%d",
		relPath,
		info.Size(),
		info.ModTime().UnixNano(),
	)
	if cached, ok := s.versionCache.Get(cacheKey); ok {
		return cached, nil
	}

	contents, err := os.ReadFile(absPath)
	if err != nil {
		return cachedFileVersion{}, err
	}

	result := buildCachedFileVersion(relPath, contents)
	s.versionCache.Set(cacheKey, result)

	return result, nil
}

func (s *Service) readGitVersion(
	ctx context.Context,
	headCommit string,
	relPath string,
) (cachedFileVersion, error) {
	cacheKey := fmt.Sprintf("git:%s:%s", headCommit, relPath)
	if cached, ok := s.versionCache.Get(cacheKey); ok {
		return cached, nil
	}

	cmd := exec.CommandContext(
		ctx,
		"git",
		"-C",
		s.repoRoot,
		"show",
		fmt.Sprintf("%s:%s", headCommit, relPath),
	)
	contents, err := cmd.Output()
	if err != nil {
		return cachedFileVersion{}, fmt.Errorf("git show %s:%s: %w", headCommit, relPath, err)
	}

	result := buildCachedFileVersion(relPath, contents)
	s.versionCache.Set(cacheKey, result)

	return result, nil
}

func buildCachedFileVersion(name string, contents []byte) cachedFileVersion {
	result := cachedFileVersion{
		version: FileVersion{
			Name:     name,
			CacheKey: hashContents(contents),
		},
	}

	if len(contents) > maxDiffFileBytes {
		result.tooLarge = true
		return result
	}

	if bytes.IndexByte(contents, 0) >= 0 {
		result.binary = true
		return result
	}

	normalized := bytes.ToValidUTF8(contents, []byte("\uFFFD"))
	result.version.Contents = string(normalized)
	result.version.CacheKey = hashContents(normalized)

	return result
}

func emptyFileVersion(name string) FileVersion {
	return FileVersion{
		Name:     name,
		Contents: "",
		CacheKey: emptyContentHash,
	}
}

func hashContents(contents []byte) string {
	hash := sha1.Sum(contents)
	return hex.EncodeToString(hash[:])
}

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
