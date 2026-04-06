package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	"diffx/internal/gitstatus"
	"diffx/internal/server"
)

const shutdownTimeout = 5 * time.Second

const (
	defaultAddress     = "127.0.0.1"
	defaultPort        = 8080
	defaultFrontendURL = "http://127.0.0.1:5173"
	portFallbackWindow = 100
)

type config struct {
	address      string
	port         int
	explicitPort bool
	dev          bool
	targetPath   string
}

func main() {
	if err := run(os.Args[1:], os.Stdout, os.Stderr); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func run(args []string, stdout, stderr io.Writer) error {
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

	fmt.Fprintf(
		stdout,
		"diffx serving %s\nrepo: %s\nscope: %s\n",
		serverURL(listener.Addr()),
		workspace.RepoRoot,
		workspace.ScopePath,
	)

	select {
	case <-ctx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
		defer cancel()

		if err := httpServer.Shutdown(shutdownCtx); err != nil {
			return fmt.Errorf("shutdown server: %w", err)
		}

		if err := <-serverErrCh; err != nil && !errors.Is(err, http.ErrServerClosed) {
			return fmt.Errorf("serve http: %w", err)
		}

		return nil
	case err := <-serverErrCh:
		if errors.Is(err, http.ErrServerClosed) {
			return nil
		}
		return fmt.Errorf("serve http: %w", err)
	}
}

func parseConfig(args []string, stderr io.Writer) (config, error) {
	cfg := config{
		address:    defaultAddress,
		port:       defaultPort,
		targetPath: ".",
	}

	flagSet := flag.NewFlagSet("diffx", flag.ContinueOnError)
	flagSet.SetOutput(stderr)
	flagSet.StringVar(&cfg.address, "a", cfg.address, "HTTP address to bind")
	flagSet.StringVar(&cfg.address, "address", cfg.address, "HTTP address to bind")
	flagSet.IntVar(&cfg.port, "p", cfg.port, "HTTP port to bind")
	flagSet.IntVar(&cfg.port, "port", cfg.port, "HTTP port to bind")
	flagSet.BoolVar(&cfg.dev, "dev", cfg.dev, "Start the Vite dev server for frontend development")
	flagSet.Usage = func() {
		fmt.Fprintln(flagSet.Output(), "Usage: diffx [path] [-a 127.0.0.1] [-p 8080] [--dev]")
		flagSet.PrintDefaults()
	}

	normalizedArgs := normalizeFlagAliases(args)
	if err := flagSet.Parse(normalizedArgs); err != nil {
		return config{}, err
	}
	flagSet.Visit(func(f *flag.Flag) {
		if f.Name == "p" || f.Name == "port" {
			cfg.explicitPort = true
		}
	})

	if cfg.port < 0 || cfg.port > 65535 {
		return config{}, fmt.Errorf("invalid port %d", cfg.port)
	}

	remainingArgs := flagSet.Args()
	if len(remainingArgs) > 1 {
		return config{}, fmt.Errorf("expected at most one path argument")
	}
	if len(remainingArgs) == 1 {
		cfg.targetPath = remainingArgs[0]
	}

	return cfg, nil
}

func normalizeFlagAliases(args []string) []string {
	normalized := make([]string, len(args))
	for index, arg := range args {
		switch {
		case arg == "-host":
			normalized[index] = "-address"
		case arg == "--host":
			normalized[index] = "--address"
		case strings.HasPrefix(arg, "-host="):
			normalized[index] = "-address=" + strings.TrimPrefix(arg, "-host=")
		case strings.HasPrefix(arg, "--host="):
			normalized[index] = "--address=" + strings.TrimPrefix(arg, "--host=")
		default:
			normalized[index] = arg
		}
	}

	return normalized
}

func listenForConfig(cfg config) (net.Listener, error) {
	if cfg.explicitPort || cfg.port != defaultPort {
		return net.Listen("tcp", net.JoinHostPort(cfg.address, strconv.Itoa(cfg.port)))
	}

	return listenWithPortFallback(cfg.address, cfg.port, portFallbackWindow)
}

func listenWithPortFallback(address string, startPort, window int) (net.Listener, error) {
	endPort := startPort + window - 1
	if endPort > 65535 {
		endPort = 65535
	}

	var lastErr error
	for port := startPort; port <= endPort; port++ {
		listener, err := net.Listen("tcp", net.JoinHostPort(address, strconv.Itoa(port)))
		if err == nil {
			return listener, nil
		}
		if !errors.Is(err, syscall.EADDRINUSE) {
			return nil, err
		}

		lastErr = err
	}

	if lastErr == nil {
		return nil, fmt.Errorf("no ports available in range %d-%d", startPort, endPort)
	}

	return nil, fmt.Errorf("no ports available in range %d-%d: %w", startPort, endPort, lastErr)
}

func serverURL(addr net.Addr) string {
	tcpAddr, ok := addr.(*net.TCPAddr)
	if !ok {
		return addr.String()
	}

	host := tcpAddr.IP.String()
	switch host {
	case "", "0.0.0.0", "::":
		host = "127.0.0.1"
	}

	return (&url.URL{
		Scheme: "http",
		Host:   net.JoinHostPort(host, strconv.Itoa(tcpAddr.Port)),
	}).String()
}

func listenerPort(addr net.Addr) int {
	tcpAddr, ok := addr.(*net.TCPAddr)
	if !ok {
		return 0
	}

	return tcpAddr.Port
}

func mustGetwd() string {
	workingDir, err := os.Getwd()
	if err != nil {
		return "."
	}

	return workingDir
}
