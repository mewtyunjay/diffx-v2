package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"diffx/internal/diagnostics"
	"diffx/internal/gitstatus"
	"diffx/internal/server"
	"diffx/internal/userconfig"
)

func main() {
	if err := run(os.Args[1:], os.Stdout, os.Stderr); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func run(args []string, stdout, stderr io.Writer) (runErr error) {
	if len(args) > 0 && args[0] == "setup" {
		if err := runSetup(args[1:], stdout, stderr); err != nil {
			if errors.Is(err, flag.ErrHelp) {
				return nil
			}
			return err
		}
		return nil
	}

	cfg, err := parseConfig(args, stderr)
	if err != nil {
		if errors.Is(err, flag.ErrHelp) {
			return nil
		}
		return err
	}

	if cfg.showVersion {
		fmt.Fprintf(stdout, "diffx %s\n", version)
		return nil
	}

	logger, closeLog := startDiagnostics(cfg, stderr)
	defer closeLog()
	defer func() {
		if runErr != nil {
			logger.Error("Diffx stopped with an error", "error", runErr)
		} else {
			logger.Info("Diffx stopped")
		}
	}()
	logger.Info("Diffx starting", "version", version, "target", cfg.targetPath, "review", cfg.reviewMode, "dev", cfg.dev)

	workspace, err := gitstatus.ResolveWorkspaceTarget(cfg.targetPath)
	if err != nil {
		return fmt.Errorf("resolve workspace: %w", err)
	}

	workspaceLogger := logger.With("repo", workspace.RepoRoot, "scope", workspace.ScopePath)
	app, err := server.New(server.Config{
		Workspace: workspace,
		Logger:    workspaceLogger,
		Frontend: server.FrontendConfig{
			Dev:        cfg.dev,
			WorkingDir: mustGetwd(),
			DevURL:     defaultFrontendURL,
			FontFamily: cfg.font,
		},
		Review: server.ReviewConfig{
			Enabled: cfg.reviewMode,
		},
	})
	if err != nil {
		return fmt.Errorf("initialize server: %w", err)
	}
	defer func() {
		if err := app.Close(); err != nil {
			workspaceLogger.Warn("server cleanup failed", "error", err)
		}
	}()

	listener, err := listenForConfig(cfg)
	if err != nil {
		return fmt.Errorf("listen: %w", err)
	}
	defer listener.Close()

	actualPort := listenerPort(listener.Addr())
	if actualPort != cfg.port {
		workspaceLogger.Debug("listener selected a different port", "requested_port", cfg.port, "port", actualPort)
		fmt.Fprintf(stdout, "port %d is in use, using %d\n", cfg.port, actualPort)
	}

	httpServer := &http.Server{
		Handler:           app.Handler(),
		ReadHeaderTimeout: 5 * time.Second,
		ErrorLog:          slog.NewLogLogger(workspaceLogger.With("component", "http").Handler(), slog.LevelError),
	}
	httpServer.RegisterOnShutdown(func() {
		_ = app.Close()
	})

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	serverErrCh := make(chan error, 1)
	go func() {
		serverErrCh <- httpServer.Serve(listener)
	}()

	modeLabel := "serving"
	if cfg.reviewMode {
		modeLabel = "review serving"
	}

	url := serverURL(listener.Addr())
	workspaceLogger.Info("server listening", "url", url)
	fmt.Fprintf(
		stdout,
		"diffx %s %s\nrepo: %s\nscope: %s\n",
		modeLabel,
		url,
		workspace.RepoRoot,
		workspace.ScopePath,
	)
	if cfg.openBrowser {
		go func() {
			if err := openBrowser(url); err != nil {
				workspaceLogger.Warn("browser launch failed", "error", err)
				fmt.Fprintf(stderr, "warning: failed to open browser: %v\n", err)
			}
		}()
	}

	if cfg.reviewMode {
		reviewCtx := ctx
		var cancel context.CancelFunc
		if cfg.reviewTimeout > 0 {
			reviewCtx, cancel = context.WithTimeout(ctx, cfg.reviewTimeout)
			defer cancel()
		}

		return runReviewSession(reviewCtx, stdout, app, httpServer, serverErrCh, workspaceLogger)
	}

	return runServerUntilShutdown(ctx, app, httpServer, serverErrCh)
}

func startDiagnostics(cfg config, stderr io.Writer) (*slog.Logger, func()) {
	output := io.Writer(io.Discard)
	if cfg.debug || cfg.dev {
		output = stderr
	}

	store, err := userconfig.NewDefaultStore()
	if err == nil {
		var log *diagnostics.Log
		log, err = diagnostics.Open(store.LogDir(), stderr)
		if err == nil {
			return diagnostics.NewLogger(io.MultiWriter(output, log)).With("pid", os.Getpid()), func() {
				if err := log.Close(); err != nil {
					fmt.Fprintln(stderr, "warning: could not close Diffx diagnostics:", err)
				}
			}
		}
	}
	fmt.Fprintln(stderr, "warning: could not start Diffx diagnostics:", err)
	return diagnostics.NewLogger(output).With("pid", os.Getpid()), func() {}
}

func mustGetwd() string {
	workingDir, err := os.Getwd()
	if err != nil {
		return "."
	}

	return workingDir
}
