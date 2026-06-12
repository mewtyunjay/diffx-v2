package gitstatus

import (
	"context"
	"fmt"
	"strings"
)

func (s *Service) readPullRequestObjectDiff(
	ctx context.Context,
	mergeBase string,
	headRef string,
	headCommit string,
	path string,
	status ChangedFileStatus,
	previousPath string,
) (FileDiffResult, error) {
	beforePath := resolveBeforePath(path, previousPath)

	result := FileDiffResult{
		Mode:          ComparisonModeBranch,
		BaseRef:       mergeBase,
		BaseCommit:    mergeBase,
		CurrentRef:    headRef,
		CurrentCommit: headCommit,
		Path:          path,
		PreviousPath:  previousPath,
		Status:        status,
		Language:      detectLanguage(path),
		Before:        emptyFileVersion(beforePath),
		After:         emptyFileVersion(path),
	}
	if status == StatusRenamed && previousPath == "" {
		result.PreviousPath = path
	}

	versions, err := assembleFileDiffVersions(
		status,
		result.Before,
		result.After,
		func() (cachedFileVersion, error) {
			return s.readGitVersion(ctx, mergeBase, beforePath)
		},
		func() (cachedFileVersion, error) {
			return s.readGitVersion(ctx, headCommit, path)
		},
	)
	if err != nil {
		return FileDiffResult{}, err
	}

	result.Before = versions.before
	result.After = versions.after
	result.Binary = versions.binary
	result.TooLarge = versions.tooLarge

	return result, nil
}

func parseNameStatusObjectDiff(output []byte) ([]ChangedFileItem, error) {
	if len(output) == 0 {
		return []ChangedFileItem{}, nil
	}

	tokens := strings.Split(string(output), "\x00")
	files := make([]ChangedFileItem, 0, len(tokens))

	for index := 0; index < len(tokens); index++ {
		token := tokens[index]
		if token == "" {
			continue
		}

		statusCode := token[0]
		switch statusCode {
		case 'R':
			if index+2 >= len(tokens) || tokens[index+1] == "" || tokens[index+2] == "" {
				return nil, fmt.Errorf("missing rename paths for diff token %q", token)
			}

			previousPath := tokens[index+1]
			path := tokens[index+2]
			index += 2

			files = append(files, objectChangedFileItem(path, previousPath, StatusRenamed))
		case 'A', 'M', 'D':
			if index+1 >= len(tokens) || tokens[index+1] == "" {
				return nil, fmt.Errorf("missing path for diff token %q", token)
			}

			path := tokens[index+1]
			index++

			files = append(files, objectChangedFileItem(path, "", mapNameStatus(statusCode)))
		default:
			return nil, fmt.Errorf("unsupported diff status token %q", token)
		}
	}

	return files, nil
}

func objectChangedFileItem(
	path string,
	previousPath string,
	status ChangedFileStatus,
) ChangedFileItem {
	return ChangedFileItem{
		ID:                 path,
		Path:               path,
		PreviousPath:       previousPath,
		Status:             status,
		IsTracked:          true,
		HasStagedChanges:   false,
		HasUnstagedChanges: false,
		ContentKey:         "missing",
		Language:           detectLanguage(path),
	}
}

func pullRequestFileContentKey(mergeBase string, headRef string, file ChangedFileItem) string {
	if file.Status == StatusDeleted {
		path := file.Path
		if file.PreviousPath != "" {
			path = file.PreviousPath
		}

		return fmt.Sprintf("git:%s:%s", mergeBase, path)
	}

	return fmt.Sprintf("git:%s:%s", headRef, file.Path)
}
