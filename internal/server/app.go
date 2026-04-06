package server

import (
	"errors"
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
	repoEvents      *repoEventHub
	repoWatcher     *repoWatcher
	assets          fs.FS
	indexHTML       []byte
	fileSrv         http.Handler
	frontendHandler http.Handler
	frontendCloser  func() error
}

func New(cfg Config) (*App, error) {
	repoEvents := newRepoEventHub()

	if shouldUseFrontendDev(cfg.Frontend) {
		frontendHandler, frontendCloser, err := newFrontendDevServer(cfg.Frontend)
		if err != nil {
			return nil, err
		}

		app, err := newApp(cfg, repoEvents)
		if err != nil {
			_ = frontendCloser()
			return nil, err
		}

		app.frontendHandler = frontendHandler
		app.frontendCloser = frontendCloser

		return app, nil
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

	app, err := newApp(cfg, newRepoEventHub())
	if err != nil {
		return nil, err
	}

	app.assets = assets
	app.indexHTML = indexHTML
	app.fileSrv = http.FileServerFS(assets)

	return app, nil
}

func (a *App) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/branches", a.handleBranches)
	mux.HandleFunc("/api/files", a.handleFiles)
	mux.HandleFunc("/api/file-diff", a.handleFileDiff)
	mux.HandleFunc("/api/events", a.handleEvents)
	mux.HandleFunc("/api/git/stage", a.handleStageFile)
	mux.HandleFunc("/api/git/unstage", a.handleUnstageFile)
	mux.HandleFunc("/api/git/commit", a.handleCommit)
	mux.HandleFunc("/api/git/push", a.handlePush)
	mux.Handle("/", a.frontend())
	return mux
}

func (a *App) Close() error {
	var errs []error
	if a.repoWatcher != nil {
		errs = append(errs, a.repoWatcher.Close())
	}
	if a.repoEvents != nil {
		errs = append(errs, a.repoEvents.Close())
	}
	if a.frontendCloser != nil {
		errs = append(errs, a.frontendCloser())
	}

	return errors.Join(errs...)
}

func newApp(cfg Config, repoEvents *repoEventHub) (*App, error) {
	watcher, err := newRepoWatcher(cfg.Workspace, repoEvents)
	if err != nil {
		_ = repoEvents.Close()
		return nil, err
	}

	return &App{
		service:     gitstatus.NewService(cfg.Workspace.RepoRoot, cfg.Workspace.ScopePath),
		repoEvents:  repoEvents,
		repoWatcher: watcher,
	}, nil
}

func (a *App) frontend() http.Handler {
	if a.frontendHandler != nil {
		return a.frontendHandler
	}

	return a.staticHandler()
}
