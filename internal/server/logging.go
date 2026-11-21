package server

import (
	"bufio"
	"bytes"
	"log/slog"
	"net"
	"net/http"
	"strings"
	"sync/atomic"
	"time"
)

const maxLoggedErrorBody = 512

var nextRequestLogID atomic.Uint64

func loggerWithComponent(logger *slog.Logger, component string) *slog.Logger {
	if logger == nil {
		return nil
	}

	return logger.With("component", component)
}

func (a *App) logAPIMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.HasPrefix(r.URL.Path, "/api/") {
			next.ServeHTTP(w, r)
			return
		}

		start := time.Now()
		recorder := &apiLogResponseWriter{
			ResponseWriter: w,
			statusCode:     http.StatusOK,
			captureError:   r.Method == http.MethodGet,
		}

		fields := []any{
			"request_id", nextRequestLogID.Add(1),
			"method", r.Method,
			"path", r.URL.Path,
		}
		query := r.URL.Query()
		for _, name := range []string{"baseRef", "hash", "number", "state", "path"} {
			if value := query.Get(name); value != "" {
				key := name
				if name == "path" {
					key = "file"
				}
				fields = append(fields, key, value)
			}
		}

		a.logger.DebugContext(r.Context(), "request started", fields...)
		next.ServeHTTP(recorder, r)
		fields = append(fields,
			"status", recorder.statusCode,
			"duration_ms", time.Since(start).Milliseconds(),
			"bytes", recorder.bytesWritten,
		)

		if err := r.Context().Err(); err != nil {
			a.logger.DebugContext(r.Context(), "request canceled", append(fields, "error", err)...)
			return
		}
		if recorder.statusCode < http.StatusBadRequest {
			a.logger.InfoContext(r.Context(), "request completed", fields...)
			return
		}

		if message := sanitizeLogMessage(recorder.body.String()); message != "" {
			fields = append(fields, "error", message)
		}
		level := slog.LevelWarn
		if recorder.statusCode >= http.StatusInternalServerError {
			level = slog.LevelError
		}
		a.logger.Log(r.Context(), level, "request failed", fields...)
	})
}

type apiLogResponseWriter struct {
	http.ResponseWriter
	statusCode   int
	captureError bool
	bytesWritten int
	wroteHeader  bool
	body         bytes.Buffer
}

func (w *apiLogResponseWriter) WriteHeader(statusCode int) {
	if w.wroteHeader {
		w.ResponseWriter.WriteHeader(statusCode)
		return
	}

	w.statusCode = statusCode
	w.wroteHeader = true
	w.ResponseWriter.WriteHeader(statusCode)
}

func (w *apiLogResponseWriter) Write(data []byte) (int, error) {
	if !w.wroteHeader {
		w.WriteHeader(http.StatusOK)
	}

	if w.captureError && w.statusCode >= http.StatusBadRequest && w.body.Len() < maxLoggedErrorBody {
		remaining := maxLoggedErrorBody - w.body.Len()
		if len(data) > remaining {
			_, _ = w.body.Write(data[:remaining])
		} else {
			_, _ = w.body.Write(data)
		}
	}

	n, err := w.ResponseWriter.Write(data)
	w.bytesWritten += n
	return n, err
}

func (w *apiLogResponseWriter) Flush() {
	flusher, ok := w.ResponseWriter.(http.Flusher)
	if ok {
		flusher.Flush()
	}
}

func (w *apiLogResponseWriter) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	hijacker, ok := w.ResponseWriter.(http.Hijacker)
	if !ok {
		return nil, nil, http.ErrNotSupported
	}

	return hijacker.Hijack()
}

func (w *apiLogResponseWriter) Push(target string, opts *http.PushOptions) error {
	pusher, ok := w.ResponseWriter.(http.Pusher)
	if !ok {
		return http.ErrNotSupported
	}

	return pusher.Push(target, opts)
}

func sanitizeLogMessage(message string) string {
	trimmed := strings.Join(strings.Fields(strings.TrimSpace(message)), " ")
	if trimmed == "" {
		return ""
	}

	if len(trimmed) <= maxLoggedErrorBody {
		return trimmed
	}

	return trimmed[:maxLoggedErrorBody-3] + "..."
}
