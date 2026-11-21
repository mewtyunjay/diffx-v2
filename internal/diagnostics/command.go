package diagnostics

import (
	"context"
	"errors"
	"log/slog"
	"strings"
	"time"
)

func Command(ctx context.Context, logger *slog.Logger, operation string, started time.Time, err error, output []byte) {
	if logger == nil {
		return
	}

	fields := []any{"operation", operation, "duration_ms", time.Since(started).Milliseconds()}
	switch {
	case errors.Is(ctx.Err(), context.DeadlineExceeded):
		logger.WarnContext(ctx, "command timed out", fields...)
	case ctx.Err() != nil:
		logger.DebugContext(ctx, "command interrupted", append(fields, "error", ctx.Err())...)
	case err != nil:
		logger.WarnContext(ctx, "command failed", append(fields, "error", err, "reason", failureReason(output))...)
	default:
		logger.DebugContext(ctx, "command completed", fields...)
	}
}

func failureReason(output []byte) string {
	if len(output) > 4096 {
		output = output[len(output)-4096:]
	}
	message := strings.ToLower(string(output))
	for _, reason := range []string{
		"index.lock", "not a git repository", "not logged in", "authentication failed",
		"bad credentials", "permission denied", "could not resolve host",
		"connection timed out", "non-fast-forward", "rate limit", "pre-commit",
		"unmerged files", "nothing to commit", "model unavailable", "quota exceeded",
	} {
		if strings.Contains(message, reason) {
			return reason
		}
	}
	return "unclassified"
}
