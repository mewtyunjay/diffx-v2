package main

import (
	"encoding/json"
	"errors"
	"net/http"
	"os"

	"diffx/gitstatus"
	"github.com/go-chi/chi/v5"
)

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
	json.NewEncoder(w).Encode(resp)
}

func filesHandler(service *gitstatus.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		result, err := service.ListChangedFiles(r.Context())
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(result)
	}
}

func fileDiffHandler(service *gitstatus.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Query().Get("path")
		if path == "" {
			http.Error(w, "path is required", http.StatusBadRequest)
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
			r.URL.Query().Get("previousPath"),
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
		json.NewEncoder(w).Encode(result)
	}
}

func fileContentHandler(service *gitstatus.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Query().Get("path")
		if path == "" {
			http.Error(w, "path is required", http.StatusBadRequest)
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
		w.Write([]byte(content))
	}
}

func main() {
	repoRoot, err := gitstatus.FindRepoRoot()
	if err != nil {
		panic(err)
	}

	service := gitstatus.NewService(repoRoot)
	r := chi.NewRouter()
	r.Use(corsMiddleware)
	r.Get("/api/hello", helloHandler)
	r.Get("/api/files", filesHandler(service))
	r.Get("/api/file-diff", fileDiffHandler(service))
	r.Get("/api/file-content", fileContentHandler(service))

	println("Server running on :8080")
	http.ListenAndServe(":8080", r)
}
