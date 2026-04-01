package gitstatus

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io/fs"
	"os/exec"
	"strings"
)

type ComparisonMode string

const (
	ComparisonModeHead   ComparisonMode = "head"
	ComparisonModeBranch ComparisonMode = "branch"
)

type BranchRef struct {
	Name      string `json:"name"`
	Kind      string `json:"kind"`
	Commit    string `json:"commit"`
	IsCurrent bool   `json:"isCurrent,omitempty"`
}

type BranchesResult struct {
	CurrentRef string      `json:"currentRef"`
	Branches   []BranchRef `json:"branches"`
}

type comparisonInfo struct {
	Mode          ComparisonMode
	BaseRef       string
	BaseCommit    string
	CurrentRef    string
	CurrentCommit string
}

var ErrInvalidBaseRef = errors.New("invalid base ref")

func (s *Service) ListBranches(ctx context.Context) (BranchesResult, error) {
	currentRef, err := s.CurrentRef(ctx)
	if err != nil {
		return BranchesResult{}, err
	}

	localRefs, err := s.listRefs(ctx, "refs/heads", "local", currentRef)
	if err != nil {
		return BranchesResult{}, err
	}

	remoteRefs, err := s.listRefs(ctx, "refs/remotes", "remote", currentRef)
	if err != nil {
		return BranchesResult{}, err
	}

	localByName := make(map[string]BranchRef, len(localRefs))
	for _, ref := range localRefs {
		localByName[ref.Name] = ref
	}

	branches := make([]BranchRef, 0, len(localRefs)+len(remoteRefs))
	branches = append(branches, localRefs...)

	for _, ref := range remoteRefs {
		if strings.HasSuffix(ref.Name, "/HEAD") || !strings.Contains(ref.Name, "/") {
			continue
		}

		remoteShortName := ref.Name
		if slashIndex := strings.Index(remoteShortName, "/"); slashIndex >= 0 {
			remoteShortName = remoteShortName[slashIndex+1:]
		}

		if localRef, ok := localByName[remoteShortName]; ok && localRef.Commit == ref.Commit {
			continue
		}

		branches = append(branches, ref)
	}

	return BranchesResult{
		CurrentRef: currentRef,
		Branches:   branches,
	}, nil
}

func (s *Service) CurrentRef(ctx context.Context) (string, error) {
	cmd := exec.CommandContext(ctx, "git", "-C", s.repoRoot, "symbolic-ref", "--quiet", "--short", "HEAD")
	output, err := cmd.Output()
	if err == nil {
		return strings.TrimSpace(string(output)), nil
	}

	if currentCommit, commitErr := s.HeadCommit(ctx); commitErr == nil {
		if len(currentCommit) > 12 {
			return currentCommit[:12], nil
		}
		return currentCommit, nil
	}

	return "", fmt.Errorf("resolve current ref: %w", err)
}

func (s *Service) resolveComparison(ctx context.Context, baseRef string) (comparisonInfo, error) {
	currentCommit, err := s.HeadCommit(ctx)
	if err != nil {
		return comparisonInfo{}, err
	}

	currentRef, err := s.CurrentRef(ctx)
	if err != nil {
		return comparisonInfo{}, err
	}

	normalizedBaseRef := strings.TrimSpace(baseRef)
	if normalizedBaseRef == "" || normalizedBaseRef == "HEAD" {
		return comparisonInfo{
			Mode:          ComparisonModeHead,
			BaseRef:       "HEAD",
			BaseCommit:    currentCommit,
			CurrentRef:    currentRef,
			CurrentCommit: currentCommit,
		}, nil
	}

	baseCommit, err := s.resolveCommit(ctx, normalizedBaseRef)
	if err != nil {
		return comparisonInfo{}, err
	}

	return comparisonInfo{
		Mode:          ComparisonModeBranch,
		BaseRef:       normalizedBaseRef,
		BaseCommit:    baseCommit,
		CurrentRef:    currentRef,
		CurrentCommit: currentCommit,
	}, nil
}

func (s *Service) resolveCommit(ctx context.Context, ref string) (string, error) {
	cmd := exec.CommandContext(ctx, "git", "-C", s.repoRoot, "rev-parse", "--verify", fmt.Sprintf("%s^{commit}", ref))
	output, err := cmd.Output()
	if err != nil {
		return "", fmt.Errorf("%w %q: %v", ErrInvalidBaseRef, ref, err)
	}

	return strings.TrimSpace(string(output)), nil
}

func (s *Service) listRefs(
	ctx context.Context,
	namespace string,
	kind string,
	currentRef string,
) ([]BranchRef, error) {
	cmd := exec.CommandContext(
		ctx,
		"git",
		"-C",
		s.repoRoot,
		"for-each-ref",
		"--format=%(refname:short)\t%(objectname)",
		namespace,
	)
	output, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("git for-each-ref %s: %w", namespace, err)
	}

	lines := bytes.Split(bytes.TrimSpace(output), []byte{'\n'})
	refs := make([]BranchRef, 0, len(lines))

	for _, line := range lines {
		if len(line) == 0 {
			continue
		}

		parts := strings.SplitN(string(line), "\t", 2)
		if len(parts) != 2 {
			return nil, fmt.Errorf("invalid ref line %q", string(line))
		}

		refs = append(refs, BranchRef{
			Name:      parts[0],
			Kind:      kind,
			Commit:    parts[1],
			IsCurrent: kind == "local" && parts[0] == currentRef,
		})
	}

	return refs, nil
}

func (s *Service) listFilesAgainstBase(
	ctx context.Context,
	baseRef string,
) ([]ChangedFileItem, error) {
	diffOutput, err := s.runGitOutput(
		ctx,
		"diff",
		"--name-status",
		"-z",
		"-M",
		baseRef,
		"--",
	)
	if err != nil {
		return nil, fmt.Errorf("git diff --name-status %s: %w", baseRef, err)
	}

	files, err := parseNameStatusDiff(diffOutput, s.repoRoot)
	if err != nil {
		return nil, err
	}

	statusOutput, err := s.runGitOutput(
		ctx,
		"status",
		"--porcelain=v1",
		"-z",
		"--untracked-files=all",
	)
	if err != nil {
		return nil, fmt.Errorf("git status: %w", err)
	}

	statusFiles, err := parsePorcelainStatus(statusOutput, s.repoRoot)
	if err != nil {
		return nil, err
	}

	statusByPath := make(map[string]ChangedFileItem, len(statusFiles))
	for _, file := range statusFiles {
		statusByPath[file.Path] = file
	}

	for index := range files {
		if statusFile, ok := statusByPath[files[index].Path]; ok {
			files[index].HasStagedChanges = statusFile.HasStagedChanges
			files[index].HasUnstagedChanges = statusFile.HasUnstagedChanges
			files[index].ContentKey = statusFile.ContentKey
		}
	}

	untrackedOutput, err := s.runGitOutput(
		ctx,
		"ls-files",
		"--others",
		"--exclude-standard",
		"-z",
		"--",
	)
	if err != nil {
		return nil, fmt.Errorf("git ls-files --others: %w", err)
	}

	existingPaths := make(map[string]struct{}, len(files))
	for _, file := range files {
		existingPaths[file.Path] = struct{}{}
	}

	untrackedFiles, err := parseUntrackedFiles(untrackedOutput, s.repoRoot)
	if err != nil {
		return nil, err
	}

	for _, file := range untrackedFiles {
		if _, ok := existingPaths[file.Path]; ok {
			continue
		}

		if statusFile, ok := statusByPath[file.Path]; ok {
			file.HasStagedChanges = statusFile.HasStagedChanges
			file.HasUnstagedChanges = statusFile.HasUnstagedChanges
			file.ContentKey = statusFile.ContentKey
		}

		files = append(files, file)
	}

	return files, nil
}

func (s *Service) runGitOutput(ctx context.Context, args ...string) ([]byte, error) {
	commandArgs := append([]string{"-C", s.repoRoot}, args...)
	cmd := exec.CommandContext(ctx, "git", commandArgs...)
	return cmd.Output()
}

func parseNameStatusDiff(output []byte, repoRoot string) ([]ChangedFileItem, error) {
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

		code := string(token)
		statusCode := code[0]
		switch statusCode {
		case 'R':
			if index+2 >= len(tokens) || len(tokens[index+1]) == 0 || len(tokens[index+2]) == 0 {
				return nil, fmt.Errorf("missing rename paths for diff token %q", code)
			}

			previousPath := string(tokens[index+1])
			path := string(tokens[index+2])
			index += 2

			item, err := buildDiffChangedFileItem(repoRoot, path, previousPath, StatusRenamed, true)
			if err != nil {
				return nil, err
			}
			files = append(files, item)
		case 'A', 'M', 'D':
			if index+1 >= len(tokens) || len(tokens[index+1]) == 0 {
				return nil, fmt.Errorf("missing path for diff token %q", code)
			}

			path := string(tokens[index+1])
			index++

			item, err := buildDiffChangedFileItem(repoRoot, path, "", mapNameStatus(statusCode), true)
			if err != nil {
				return nil, err
			}
			files = append(files, item)
		default:
			return nil, fmt.Errorf("unsupported diff status token %q", code)
		}
	}

	return files, nil
}

func parseUntrackedFiles(output []byte, repoRoot string) ([]ChangedFileItem, error) {
	if len(output) == 0 {
		return []ChangedFileItem{}, nil
	}

	tokens := bytes.Split(output, []byte{0})
	files := make([]ChangedFileItem, 0, len(tokens))

	for _, token := range tokens {
		if len(token) == 0 {
			continue
		}

		item, err := buildDiffChangedFileItem(repoRoot, string(token), "", StatusAdded, false)
		if err != nil {
			return nil, err
		}
		item.HasUnstagedChanges = true
		files = append(files, item)
	}

	return files, nil
}

func buildDiffChangedFileItem(
	repoRoot string,
	path string,
	previousPath string,
	status ChangedFileStatus,
	isTracked bool,
) (ChangedFileItem, error) {
	item := ChangedFileItem{
		ID:                 path,
		Path:               path,
		PreviousPath:       previousPath,
		Status:             status,
		IsTracked:          isTracked,
		HasStagedChanges:   false,
		HasUnstagedChanges: false,
		ContentKey:         "missing",
		Language:           detectLanguage(path),
	}

	if key, err := buildContentKey(repoRoot, path); err == nil {
		item.ContentKey = key
	} else if !errors.Is(err, fs.ErrNotExist) {
		return ChangedFileItem{}, err
	}

	return item, nil
}

func mapNameStatus(code byte) ChangedFileStatus {
	switch code {
	case 'A':
		return StatusAdded
	case 'D':
		return StatusDeleted
	default:
		return StatusModified
	}
}
