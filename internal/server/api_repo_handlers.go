package server

import (
	"bytes"
	"fmt"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"diffx/internal/gitstatus"
)

func (a *App) handleBranches(w http.ResponseWriter, r *http.Request) {
	if !allowMethod(w, r, http.MethodGet) {
		return
	}

	result, err := a.service.ListBranches(r.Context())
	if err != nil {
		writeAPIError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, result)
}

func (a *App) handleCommits(w http.ResponseWriter, r *http.Request) {
	if !allowMethod(w, r, http.MethodGet) {
		return
	}

	limit, err := strconv.Atoi(r.URL.Query().Get("limit"))
	if err != nil {
		limit = 0
	}
	offset, err := strconv.Atoi(r.URL.Query().Get("offset"))
	if err != nil {
		offset = 0
	}

	result, err := a.service.ListCommits(r.Context(), limit, offset)
	if err != nil {
		writeAPIError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, result)
}

func (a *App) handleCommitDetail(w http.ResponseWriter, r *http.Request) {
	if !allowMethod(w, r, http.MethodGet) {
		return
	}

	hash := r.URL.Query().Get("hash")
	if hash == "" {
		http.Error(w, "hash is required", http.StatusBadRequest)
		return
	}

	result, err := a.service.ReadCommitDetail(r.Context(), hash)
	if err != nil {
		writeAPIError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, result)
}

func (a *App) handleCommitFileDiff(w http.ResponseWriter, r *http.Request) {
	if !allowMethod(w, r, http.MethodGet) {
		return
	}

	query := r.URL.Query()
	hash := query.Get("hash")
	if hash == "" {
		http.Error(w, "hash is required", http.StatusBadRequest)
		return
	}

	path := query.Get("path")
	if path == "" {
		http.Error(w, "path is required", http.StatusBadRequest)
		return
	}

	status := gitstatus.ChangedFileStatus(query.Get("status"))
	if !status.IsValid() {
		http.Error(w, fmt.Sprintf("invalid status %q", status), http.StatusBadRequest)
		return
	}

	previousPath := query.Get("previousPath")
	if !a.service.AllowsDiff(path, previousPath) {
		http.Error(w, "path is outside the current workspace scope", http.StatusBadRequest)
		return
	}

	result, err := a.service.ReadCommitFileDiff(r.Context(), hash, path, status, previousPath)
	if err != nil {
		writeAPIError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, result)
}

func (a *App) handleFiles(w http.ResponseWriter, r *http.Request) {
	if !allowMethod(w, r, http.MethodGet) {
		return
	}

	result, err := a.service.ListChangedFiles(r.Context(), r.URL.Query().Get("baseRef"))
	if err != nil {
		writeAPIError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, result)
}

func (a *App) handleFileDiff(w http.ResponseWriter, r *http.Request) {
	if !allowMethod(w, r, http.MethodGet) {
		return
	}

	query := r.URL.Query()
	path := query.Get("path")
	if path == "" {
		http.Error(w, "path is required", http.StatusBadRequest)
		return
	}

	status := gitstatus.ChangedFileStatus(query.Get("status"))
	if !status.IsValid() {
		http.Error(w, fmt.Sprintf("invalid status %q", status), http.StatusBadRequest)
		return
	}

	previousPath := query.Get("previousPath")
	if !a.service.AllowsDiff(path, previousPath) {
		http.Error(w, "path is outside the current workspace scope", http.StatusBadRequest)
		return
	}

	result, err := a.service.ReadFileDiff(r.Context(), path, status, previousPath, query.Get("baseRef"))
	if err != nil {
		writeAPIError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, result)
}

func (a *App) handleFilePreview(w http.ResponseWriter, r *http.Request) {
	if !allowMethod(w, r, http.MethodGet) {
		return
	}

	path := r.URL.Query().Get("path")
	if path == "" {
		http.Error(w, "path is required", http.StatusBadRequest)
		return
	}
	if !a.service.AllowsDiff(path, "") {
		http.Error(w, "path is outside the current workspace scope", http.StatusBadRequest)
		return
	}

	contentType := ""
	switch strings.ToLower(filepath.Ext(path)) {
	case ".svg":
		contentType = "image/svg+xml"
	case ".png":
		contentType = "image/png"
	case ".jpg", ".jpeg":
		contentType = "image/jpeg"
	default:
		http.Error(w, "file type cannot be previewed", http.StatusBadRequest)
		return
	}

	contents, err := a.service.ReadFilePreview(path)
	if err != nil {
		writeAPIError(w, err)
		return
	}

	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Content-Security-Policy", "script-src 'none'; object-src 'none'; base-uri 'none'")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	http.ServeContent(w, r, filepath.Base(path), time.Time{}, bytes.NewReader(contents))
}
