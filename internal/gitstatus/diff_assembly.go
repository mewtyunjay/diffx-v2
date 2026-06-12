package gitstatus

type versionSource func() (cachedFileVersion, error)

type assembledVersions struct {
	before   FileVersion
	after    FileVersion
	binary   bool
	tooLarge bool
}

func assembleFileDiffVersions(
	status ChangedFileStatus,
	emptyBefore FileVersion,
	emptyAfter FileVersion,
	before versionSource,
	after versionSource,
) (assembledVersions, error) {
	beforeResult := cachedFileVersion{version: emptyBefore}
	afterResult := cachedFileVersion{version: emptyAfter}
	var err error

	switch status {
	case StatusAdded:
		afterResult, err = after()
	case StatusDeleted:
		beforeResult, err = before()
	default:
		err = runParallel(
			func() error {
				var readErr error
				beforeResult, readErr = before()
				return readErr
			},
			func() error {
				var readErr error
				afterResult, readErr = after()
				return readErr
			},
		)
	}
	if err != nil {
		return assembledVersions{}, err
	}

	return assembledVersions{
		before:   beforeResult.version,
		after:    afterResult.version,
		binary:   beforeResult.binary || afterResult.binary,
		tooLarge: beforeResult.tooLarge || afterResult.tooLarge,
	}, nil
}

func resolveBeforePath(path string, previousPath string) string {
	if previousPath != "" {
		return previousPath
	}

	return path
}
