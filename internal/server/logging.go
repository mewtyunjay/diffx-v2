package server

import (
	"bufio"
	"bytes"
	"context"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"
)

const maxLoggedErrorBody = 512

type compactLogHandler struct {
	output io.Writer
	level  slog.Level
	attrs  []slog.Attr
	mu     *sync.Mutex
}

func newBackendLogger(cfg FrontendConfig) *slog.Logger {
	if !cfg.Dev && !cfg.Debug {
		return nil
	}

	output := cfg.LogOutput
	if output == nil {
		output = os.Stdout
	}

	return slog.New(&compactLogHandler{
		output: output,
		level:  slog.LevelDebug,
		mu:     &sync.Mutex{},
	})
}

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
		}

		next.ServeHTTP(recorder, r)

		duration := time.Since(start).Round(time.Millisecond)
		if recorder.statusCode < http.StatusBadRequest {
			a.logger.Info(
				"request completed",
				"method", r.Method,
				"path", r.URL.Path,
				"status", recorder.statusCode,
				"duration", duration,
			)
			return
		}

		message := sanitizeLogMessage(recorder.body.String())
		if message == "" {
			a.logger.Warn(
				"request failed",
				"method", r.Method,
				"path", r.URL.Path,
				"status", recorder.statusCode,
				"duration", duration,
			)
			return
		}

		a.logger.Warn(
			"request failed",
			"method", r.Method,
			"path", r.URL.Path,
			"status", recorder.statusCode,
			"duration", duration,
			"error", message,
		)
	})
}

func (h *compactLogHandler) Enabled(_ context.Context, level slog.Level) bool {
	return level >= h.level
}

func (h *compactLogHandler) Handle(_ context.Context, record slog.Record) error {
	var attrs []slog.Attr
	attrs = append(attrs, h.attrs...)
	record.Attrs(func(attr slog.Attr) bool {
		attrs = append(attrs, attr)
		return true
	})

	component := "diffx"
	compactAttrs := make([]slog.Attr, 0, len(attrs))
	for _, attr := range attrs {
		attr.Value = attr.Value.Resolve()
		if attr.Key == "component" {
			if value := strings.TrimSpace(attr.Value.String()); value != "" {
				component = value
			}
			continue
		}
		compactAttrs = append(compactAttrs, attr)
	}

	line := strings.TrimSpace(strings.Join([]string{
		record.Time.Format("15:04:05.000"),
		fmt.Sprintf("[%s]", component),
		levelLabel(record.Level),
		record.Message,
		formatCompactAttrs(compactAttrs),
	}, " "))

	h.mu.Lock()
	defer h.mu.Unlock()
	_, err := fmt.Fprintln(h.output, line)
	return err
}

func (h *compactLogHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	next := *h
	next.attrs = append(append([]slog.Attr(nil), h.attrs...), attrs...)
	return &next
}

func (h *compactLogHandler) WithGroup(_ string) slog.Handler {
	return h
}

func levelLabel(level slog.Level) string {
	switch {
	case level >= slog.LevelError:
		return "ERROR"
	case level >= slog.LevelWarn:
		return "WARN"
	case level <= slog.LevelDebug:
		return "DEBUG"
	default:
		return "INFO"
	}
}

func formatCompactAttrs(attrs []slog.Attr) string {
	if len(attrs) == 0 {
		return ""
	}

	parts := make([]string, 0, len(attrs))
	for _, attr := range attrs {
		if attr.Key == "" {
			continue
		}

		value := formatCompactValue(attr.Value)
		switch attr.Key {
		case "error", "stderr", "stdout", "reason":
			parts = append(parts, fmt.Sprintf("%s=%q", attr.Key, value))
		default:
			parts = append(parts, value)
		}
	}

	return strings.Join(parts, " ")
}

func formatCompactValue(value slog.Value) string {
	value = value.Resolve()
	switch value.Kind() {
	case slog.KindString:
		return value.String()
	case slog.KindDuration:
		return value.Duration().String()
	case slog.KindTime:
		return value.Time().Format(time.RFC3339)
	case slog.KindBool:
		if value.Bool() {
			return "true"
		}
		return "false"
	case slog.KindInt64:
		return fmt.Sprint(value.Int64())
	case slog.KindUint64:
		return fmt.Sprint(value.Uint64())
	case slog.KindFloat64:
		return fmt.Sprint(value.Float64())
	case slog.KindAny:
		if value.Any() == nil {
			return ""
		}
		return fmt.Sprint(value.Any())
	default:
		return value.String()
	}
}

var _ slog.Handler = (*compactLogHandler)(nil)

type apiLogResponseWriter struct {
	http.ResponseWriter
	statusCode  int
	wroteHeader bool
	body        bytes.Buffer
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

	if w.statusCode >= http.StatusBadRequest && w.body.Len() < maxLoggedErrorBody {
		remaining := maxLoggedErrorBody - w.body.Len()
		if len(data) > remaining {
			_, _ = w.body.Write(data[:remaining])
		} else {
			_, _ = w.body.Write(data)
		}
	}

	return w.ResponseWriter.Write(data)
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
