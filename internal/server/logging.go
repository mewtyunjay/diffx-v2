package server

import (
	"bufio"
	"bytes"
	"log"
	"net"
	"net/http"
	"os"
	"strings"
	"time"
)

const maxLoggedErrorBody = 512

func newAPILogger(cfg FrontendConfig) *log.Logger {
	if !cfg.Dev {
		return nil
	}

	output := cfg.LogOutput
	if output == nil {
		output = os.Stdout
	}

	return log.New(output, "[diffx] ", log.LstdFlags)
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
		if recorder.statusCode >= http.StatusBadRequest {
			message := sanitizeLogMessage(recorder.body.String())
			if message == "" {
				a.apiLogger.Printf("%s %s -> %d (%s)", r.Method, r.URL.Path, recorder.statusCode, duration)
				return
			}

			a.apiLogger.Printf("%s %s -> %d (%s) error=%q", r.Method, r.URL.Path, recorder.statusCode, duration, message)
			return
		}

		a.apiLogger.Printf("%s %s -> %d (%s)", r.Method, r.URL.Path, recorder.statusCode, duration)
	})
}

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
