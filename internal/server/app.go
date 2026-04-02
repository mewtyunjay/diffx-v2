package server

import (
	"io/fs"
	"net/http"

	frontendassets "diffx/frontend"
	"diffx/internal/gitstatus"
)

type FrontendConfig struct {
	Dev        bool
	WorkingDir string
	DevURL     string
}

type Config struct {
	Workspace gitstatus.WorkspaceTarget
	Frontend  FrontendConfig
}

type App struct {
	service         *gitstatus.Service
	assets          fs.FS
	indexHTML       []byte
	fileSrv         http.Handler
	frontendHandler http.Handler
	frontendCloser  func() error
}

func New(cfg Config) (*App, error) {
	if shouldUseFrontendDev(cfg.Frontend) {
		frontendHandler, frontendCloser, err := newFrontendDevServer(cfg.Frontend)
		if err != nil {
			return nil, err
		}

		return &App{
			service:         gitstatus.NewService(cfg.Workspace.RepoRoot, cfg.Workspace.ScopePath),
			frontendHandler: frontendHandler,
			frontendCloser:  frontendCloser,
		}, nil
	}

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
		service:   gitstatus.NewService(cfg.Workspace.RepoRoot, cfg.Workspace.ScopePath),
		assets:    assets,
		indexHTML: indexHTML,
		fileSrv:   http.FileServerFS(assets),
	}, nil
}

func (a *App) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/branches", a.handleBranches)
	mux.HandleFunc("/api/files", a.handleFiles)
	mux.HandleFunc("/api/file-diff", a.handleFileDiff)
	mux.HandleFunc("/api/git/stage", a.handleStageFile)
	mux.HandleFunc("/api/git/unstage", a.handleUnstageFile)
	mux.HandleFunc("/api/git/commit", a.handleCommit)
	mux.HandleFunc("/api/git/push", a.handlePush)
	mux.Handle("/", a.frontend())
	return mux
}

func (a *App) Close() error {
	if a.frontendCloser == nil {
		return nil
	}

	return a.frontendCloser()
}

func (a *App) frontend() http.Handler {
	if a.frontendHandler != nil {
		return a.frontendHandler
	}

	return a.staticHandler()
}
