package main

import (
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"diffx/gitstatus"
	"github.com/go-chi/chi/v5"
)

func newRouter(service *gitstatus.Service, webRoot string) http.Handler {
	router := chi.NewRouter()
	router.Use(corsMiddleware)
	router.Get("/api/hello", helloHandler)
	router.Get("/api/files", filesHandler(service))
	router.Get("/api/file-diff", fileDiffHandler(service))
	router.Get("/api/file-content", fileContentHandler(service))

	if webRoot != "" {
		router.NotFound(staticHandler(webRoot))
	}

	return router
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func helloHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	resp := map[string]string{
		"message": "Hello from Go backend",
	}
	_ = json.NewEncoder(w).Encode(resp)
}

func filesHandler(service *gitstatus.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		result, err := service.ListChangedFiles(r.Context())
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		if len(result.Files) > 0 {
			initialFile := result.Files[0]
			initialDiff, err := service.ReadFileDiff(
				r.Context(),
				initialFile.Path,
				initialFile.Status,
				initialFile.PreviousPath,
				result.HeadCommit,
			)
			if err == nil {
				result.InitialDiff = &initialDiff
			}
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(result)
	}
}

func fileDiffHandler(service *gitstatus.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Query().Get("path")
		if path == "" {
			http.Error(w, "path is required", http.StatusBadRequest)
			return
		}

		previousPath := r.URL.Query().Get("previousPath")
		if !service.AllowsDiff(path, previousPath) {
			http.Error(w, "file diff outside active scope", http.StatusForbidden)
			return
		}

		status := gitstatus.ChangedFileStatus(r.URL.Query().Get("status"))
		if !status.IsValid() {
			http.Error(w, "status is required", http.StatusBadRequest)
			return
		}

		result, err := service.ReadFileDiff(
			r.Context(),
			path,
			status,
			previousPath,
			r.URL.Query().Get("headCommit"),
		)
		if err != nil {
			if errors.Is(err, os.ErrNotExist) {
				http.Error(w, "file diff unavailable", http.StatusNotFound)
				return
			}

			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(result)
	}
}

func fileContentHandler(service *gitstatus.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Query().Get("path")
		if path == "" {
			http.Error(w, "path is required", http.StatusBadRequest)
			return
		}
		if !service.AllowsFile(path) {
			http.Error(w, "file content outside active scope", http.StatusForbidden)
			return
		}

		content, contentKey, err := service.ReadFileContent(path)
		if err != nil {
			if errors.Is(err, os.ErrNotExist) {
				http.Error(w, "file content unavailable", http.StatusNotFound)
				return
			}

			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		w.Header().Set("X-Content-Key", contentKey)
		_, _ = w.Write([]byte(content))
	}
}

func staticHandler(webRoot string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			http.NotFound(w, r)
			return
		}

		relativePath := strings.TrimPrefix(r.URL.Path, "/")
		if relativePath == "" {
			relativePath = "index.html"
		}

		assetPath, err := resolveStaticPath(webRoot, relativePath)
		if err == nil {
			if info, statErr := os.Stat(assetPath); statErr == nil && !info.IsDir() {
				http.ServeFile(w, r, assetPath)
				return
			}
		}

		http.ServeFile(w, r, filepath.Join(webRoot, "index.html"))
	}
}

func resolveStaticPath(webRoot, relativePath string) (string, error) {
	assetPath := filepath.Join(webRoot, filepath.Clean(filepath.FromSlash(relativePath)))
	absoluteAssetPath, err := filepath.Abs(assetPath)
	if err != nil {
		return "", err
	}

	relativeToRoot, err := filepath.Rel(webRoot, absoluteAssetPath)
	if err != nil {
		return "", err
	}
	if relativeToRoot == ".." || strings.HasPrefix(relativeToRoot, ".."+string(filepath.Separator)) {
		return "", errors.New("path escapes web root")
	}

	return absoluteAssetPath, nil
}
