package server

import (
	"bytes"
	"io/fs"
	"net/http"
	"path"
	"strings"
	"time"
)

func (a *App) staticHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			http.NotFound(w, r)
			return
		}

		requestPath := normalizeRequestPath(r.URL.Path)
		if requestPath == "." {
			a.serveIndex(w, r)
			return
		}

		if fileExists(a.assets, requestPath) {
			a.fileSrv.ServeHTTP(w, r)
			return
		}

		// Route-like paths should fall back to the SPA shell, but missing assets should not.
		if strings.Contains(path.Base(requestPath), ".") {
			http.NotFound(w, r)
			return
		}

		a.serveIndex(w, r)
	})
}

func (a *App) serveIndex(w http.ResponseWriter, r *http.Request) {
	http.ServeContent(
		w,
		r,
		"index.html",
		fileModTime(a.assets, "index.html"),
		bytes.NewReader(a.indexHTML),
	)
}

func normalizeRequestPath(requestPath string) string {
	cleaned := path.Clean("/" + requestPath)
	normalized := strings.TrimPrefix(cleaned, "/")
	if normalized == "" {
		return "."
	}
	return normalized
}

func fileExists(fsys fs.FS, filePath string) bool {
	info, err := fs.Stat(fsys, filePath)
	return err == nil && !info.IsDir()
}

func fileModTime(fsys fs.FS, filePath string) time.Time {
	info, err := fs.Stat(fsys, filePath)
	if err != nil {
		return time.Time{}
	}
	return info.ModTime()
}
