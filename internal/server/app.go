package server

import (
	"io/fs"
	"net/http"

	frontendassets "diffx/frontend"
	"diffx/internal/gitstatus"
)

type Config struct {
	Workspace gitstatus.WorkspaceTarget
}

type App struct {
	workspace gitstatus.WorkspaceTarget
	service   *gitstatus.Service
	assets    fs.FS
	indexHTML []byte
	fileSrv   http.Handler
}

func New(cfg Config) (*App, error) {
	assets, err := loadAssets(frontendassets.Dist)
	if err != nil {
		return nil, err
	}

	return newWithAssetFS(cfg, assets)
}

func newWithAssets(cfg Config, embeddedAssets fs.FS) (*App, error) {
	assets, err := fs.Sub(embeddedAssets, "dist")
	if err != nil {
		return nil, err
	}

	return newWithAssetFS(cfg, assets)
}

func newWithAssetFS(cfg Config, assets fs.FS) (*App, error) {
	indexHTML, err := fs.ReadFile(assets, "index.html")
	if err != nil {
		return nil, err
	}

	return &App{
		workspace: cfg.Workspace,
		service:   gitstatus.NewService(cfg.Workspace.RepoRoot, cfg.Workspace.ScopePath),
		assets:    assets,
		indexHTML: indexHTML,
		fileSrv:   http.FileServerFS(assets),
	}, nil
}

func (a *App) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/hello", a.handleHello)
	mux.HandleFunc("/api/branches", a.handleBranches)
	mux.HandleFunc("/api/files", a.handleFiles)
	mux.HandleFunc("/api/file-diff", a.handleFileDiff)
	mux.Handle("/", a.staticHandler())
	return mux
}
