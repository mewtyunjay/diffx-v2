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
)

type ChangedFileStatus string

const (
	StatusAdded    ChangedFileStatus = "added"
	StatusModified ChangedFileStatus = "modified"
	StatusDeleted  ChangedFileStatus = "deleted"
	StatusRenamed  ChangedFileStatus = "renamed"
)

type ChangedFileItem struct {
	ID                 string            `json:"id"`
	Path               string            `json:"path"`
	Status             ChangedFileStatus `json:"status"`
	IsTracked          bool              `json:"isTracked"`
	HasStagedChanges   bool              `json:"hasStagedChanges"`
	HasUnstagedChanges bool              `json:"hasUnstagedChanges"`
	ContentKey         string            `json:"contentKey"`
}

type Service struct {
	repoRoot string
}

func NewService(repoRoot string) *Service {
	return &Service{repoRoot: repoRoot}
}

func FindRepoRoot() (string, error) {
	cmd := exec.Command("git", "rev-parse", "--show-toplevel")
	output, err := cmd.Output()
	if err != nil {
		return "", fmt.Errorf("find repo root: %w", err)
	}

	return strings.TrimSpace(string(output)), nil
}

func (s *Service) ListChangedFiles(ctx context.Context) ([]ChangedFileItem, error) {
	cmd := exec.CommandContext(
		ctx,
		"git",
		"-C",
		s.repoRoot,
		"status",
		"--porcelain=v1",
		"-z",
		"--untracked-files=all",
	)
	output, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("git status: %w", err)
	}

	return parsePorcelainStatus(output, s.repoRoot)
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

		if code[0] == 'R' || code[1] == 'R' {
			if index+1 < len(tokens) && len(tokens[index+1]) > 0 {
				index++
			}
		}

		item := ChangedFileItem{
			ID:                 path,
			Path:               path,
			Status:             mapChangedStatus(code),
			IsTracked:          code != "??",
			HasStagedChanges:   code[0] != ' ' && code[0] != '?',
			HasUnstagedChanges: code == "??" || (code[1] != ' ' && code[1] != '?'),
			ContentKey:         "missing",
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
	absPath, err := ResolveRepoPath(s.repoRoot, relPath)
	if err != nil {
		return "", "", err
	}

	contents, err := os.ReadFile(absPath)
	if err != nil {
		return "", "", err
	}

	normalized := bytes.ToValidUTF8(contents, []byte("\uFFFD"))
	hash := sha1.Sum(normalized)

	return string(normalized), hex.EncodeToString(hash[:]), nil
}
