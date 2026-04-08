package server

import (
	"context"
	"errors"
	"io"
	"io/fs"
	"log"
	"net/http"
	"sync"

	frontendassets "diffx/frontend"
	"diffx/internal/gitstatus"
)

type FrontendConfig struct {
	Dev        bool
	WorkingDir string
	DevURL     string
	LogOutput  io.Writer
}

type Config struct {
	Workspace gitstatus.WorkspaceTarget
	Frontend  FrontendConfig
	Review    ReviewConfig
}

type ReviewConfig struct {
	Enabled bool
}

type App struct {
	service         *gitstatus.Service
	repoEvents      *repoEventHub
	repoWatcher     *repoWatcher
	reviewFeedback  *reviewFeedbackCoordinator
	assets          fs.FS
	indexHTML       []byte
	fileSrv         http.Handler
	frontendHandler http.Handler
	frontendCloser  func() error
	apiLogger       *log.Logger
	closeOnce       sync.Once
	closeErr        error
}

func New(cfg Config) (*App, error) {
	repoEvents := newRepoEventHub()
	logger := newAPILogger(cfg.Frontend)

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
		app.apiLogger = logger

		return app, nil
	}

	assets, err := loadAssets(frontendassets.Dist)
	if err != nil {
		return nil, err
	}

	app, err := newWithAssetFS(cfg, assets)
	if err != nil {
		return nil, err
	}
	app.apiLogger = logger

	return app, nil
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
	a.registerRoutes(mux)
	handler := a.suppressRepoWatcherGitEventsMiddleware(mux)
	if a.apiLogger != nil {
		return a.logAPIMiddleware(handler)
	}

	return handler
}

func (a *App) Close() error {
	a.closeOnce.Do(func() {
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
		if a.reviewFeedback != nil {
			a.reviewFeedback.Close()
		}

		a.closeErr = errors.Join(errs...)
	})

	return a.closeErr
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
		reviewFeedback: newReviewFeedbackCoordinator(
			cfg.Review.Enabled,
		),
	}, nil
}

func (a *App) ReviewModeEnabled() bool {
	if a.reviewFeedback == nil {
		return false
	}

	return a.reviewFeedback.Enabled()
}

func (a *App) SubmitReviewFeedback(feedback ReviewFeedback) error {
	if a.reviewFeedback == nil {
		return ErrReviewFeedbackDisabled
	}

	return a.reviewFeedback.Submit(feedback)
}

func (a *App) WaitForReviewFeedback(ctx context.Context) (ReviewFeedback, error) {
	if a.reviewFeedback == nil {
		return ReviewFeedback{}, ErrReviewFeedbackDisabled
	}

	return a.reviewFeedback.Wait(ctx)
}

func (a *App) frontend() http.Handler {
	if a.frontendHandler != nil {
		return a.frontendHandler
	}

	return a.staticHandler()
}
