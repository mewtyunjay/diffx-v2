package gitstatus

import "errors"

var (
	ErrPathRequired    = errors.New("path is required")
	ErrBranchRequired  = errors.New("branch is required")
	ErrAbsolutePath    = errors.New("absolute paths are not allowed")
	ErrPathEscapesRepo = errors.New("path escapes repo root")
	ErrNotAFile        = errors.New("path is not a file")
)
