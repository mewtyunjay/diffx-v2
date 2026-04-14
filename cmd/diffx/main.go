package main

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"diffx/internal/gitstatus"
	"diffx/internal/server"
)

func main() {
	if err := run(os.Args[1:], os.Stdout, os.Stderr); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func run(args []string, stdout, stderr io.Writer) error {
	if len(args) > 0 && args[0] == "release" {
		return runRelease(args[1:], stdout, stderr)
	}

	if len(args) > 0 && args[0] == "setup" {
		return runSetup(args[1:], stdout, stderr)
	}

	cfg, err := parseConfig(args, stderr)
	if err != nil {
		return err
	}

	workspace, err := gitstatus.ResolveWorkspaceTarget(cfg.targetPath)
	if err != nil {
		return err
	}

	app, err := server.New(server.Config{
		Workspace: workspace,
		Frontend: server.FrontendConfig{
			Dev:        cfg.dev,
			WorkingDir: mustGetwd(),
			DevURL:     defaultFrontendURL,
			LogOutput:  stdout,
		},
		Review: server.ReviewConfig{
			Enabled: cfg.reviewMode,
		},
	})
	if err != nil {
		return err
	}
	defer app.Close()

	listener, err := listenForConfig(cfg)
	if err != nil {
		return fmt.Errorf("listen: %w", err)
	}
	defer listener.Close()

	actualPort := listenerPort(listener.Addr())
	if actualPort != cfg.port {
		fmt.Fprintf(stdout, "port %d is in use, using %d\n", cfg.port, actualPort)
	}

	httpServer := &http.Server{
		Handler:           app.Handler(),
		ReadHeaderTimeout: 5 * time.Second,
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

	fmt.Fprintf(
		stdout,
		"diffx %s %s\nrepo: %s\nscope: %s\n",
		modeLabel,
		serverURL(listener.Addr()),
		workspace.RepoRoot,
		workspace.ScopePath,
	)
	if cfg.openBrowser {
		go tryOpenBrowser(serverURL(listener.Addr()), stderr)
	}

	if cfg.reviewMode {
		reviewCtx := ctx
		var cancel context.CancelFunc
		if cfg.reviewTimeout > 0 {
			reviewCtx, cancel = context.WithTimeout(ctx, cfg.reviewTimeout)
			defer cancel()
		}

		return runReviewSession(reviewCtx, stdout, app, httpServer, serverErrCh)
	}

	return runServerUntilShutdown(ctx, app, httpServer, serverErrCh)
}

func mustGetwd() string {
	workingDir, err := os.Getwd()
	if err != nil {
		return "."
	}

	return workingDir
}
